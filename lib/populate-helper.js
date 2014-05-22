var async = require('async'),
  _ = require('underscore'),
  schemaHelper = require('./schema-helper')

function Populator(config) {
  this.loaded = {};
  this.map = [];
  this.models = config.models;
  this.data = config.data;
  this.modelName = config.modelName;
  this.callback = config.callback;
}

Populator.prototype.run = function () {

  var self = this;

  var model = this.models[this.modelName];

  //Walk the nested document
  this.explore(model);

  async.eachSeries(this.map, function (m, next) {

    try {

      //If the model is defined, but no schema defined, there will be an error.
      self.models[m.name].populate(self.data, m.members, function (err, d) {
        next(null, d);
      });

    } catch (e) {
      next(null, self.data);
    }

  }, function (err, d) {

    if (self.callback) {
      self.callback(err, self.data);
    }

  });

}

Populator.prototype.explore = function (model, parent) {

  if (!model) {
    return;
  }

  var tree = model.schema.tree;

  var treed = _.map(tree, function (v, k) {

    if (v.ref && v.ref.search(/^\_|^ActivityType$/) != -1) {
      return {
        shortPath: k,
        path: (parent ? parent + '.' : '') + k,
        model: v.ref
      }
    }
    if (Object.prototype.toString.call(v) == '[object Array]' && v.length > 0 && v[0].ref && v[0].ref.search(/^\_|^Person$|^ActivityType$/) != -1) {
      return {
        shortPath: k,
        path: (parent ? parent + '.' : '') + k,
        model: v[0].ref
      }
    }
  });
  treed = _.compact(treed);

  this.map.push({
    name: model.modelName,
    members: treed
  });

  if (treed.length > 0) {
    this.recurse(treed);
  }

}

Populator.prototype.recurse = function (models) {

  var self = this;

  _.each(models, function (d) {
    if (!self.loaded[d.model]) {
      self.loaded[d.model] = 1;
      self.explore(self.models[d.model], d.path);
    } else {
      self.loaded[d.model] += 1;
    }
  });

}

function Inhabitant(config) {
  this.config = config;
  try {
    if (!this.models) {
      this.models = schemaHelper.loadSchemas(config.schemasFolder);
    }
  } catch (e) {
    console.log(e.message);
  }
};

Inhabitant.prototype.populateAll = function (modelName, filter, promise) {

  var time = process.hrtime();
  var model = this.models[modelName];
  var self = this;

  model.find(filter, function (err, arr) {

    async.map(arr, function (d, cb) {

      var options = {
        models: self.models,
        modelName: modelName,
        callback: cb,
        data: d
      };

      var populator = new Populator(options);

      populator.run();


    }, function (err, results) {

      console.log('model: ' + modelName + '|count: ' + results.length + '|elapsed: ' + process.hrtime(time));

      if (promise) {
        promise(null, results);
      }
    });

  });

}

module.exports = Inhabitant;