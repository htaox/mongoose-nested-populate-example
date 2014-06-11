var async = require('async'),
  _ = require('underscore'),
  schemaHelper = require('./schema-helper')

function Populator(config) {
  //this.loaded = {};
  //this.map = [];
  this.map = config.map;
  this.models = config.models;
  this.data = config.data;
  //this.modelName = config.modelName;
  this.callback = config.callback;
  this.debug = config.debug;
}

Populator.prototype.run = function () {

  var self = this;

  //var model = this.models[this.modelName];

  //Walk the nested document
  //this.explore(model);

  async.eachSeries(this.map, function (m, next) {
    try {
      //If the model is defined, but no schema defined, there will be an error.
      self.models[m.name].populate(self.data, m.members, function (err, d) {
        next(null, d);
      });

    } catch (e) {
      console.log(e.message)
      next(null, self.data);
    }

  }, function (err) {

    if (self.debug) {
      require('fs').writeFileSync(__dirname + '/DEBUG/' + self.data.id + '.json', JSON.stringify(self.data,null,'\t'), {encoding:'utf8'});
    }

    if (self.callback) {
      self.callback(err, self.data);
    }

  });

}

function Inhabitant(config) {
  this.config = config;
  this.loaded = {};
  this.maps = {};

  try {
    if (!this.models) {
      this.models = schemaHelper.loadSchemas(config.schemasFolder);
    }
  } catch (e) {
    console.log(e.message);
  }
  
};

Inhabitant.prototype.explore = function (model, parent) {

  if (!model) {
    return;
  }

  if (!this.maps[model.modelName]) {
    this.maps[model.modelName] = [];
    this.loaded = {};
  }
  
  var tree = model.schema.tree;

  var treed = _.map(tree, function (v, k) {

    //if (v.ref && v.ref.search(/^\_|^Person$|^ActivityType$/) != -1) {
    if (v.ref && v.ref.search(/^\_|^Person$/) != -1) {
      return {
        shortPath: k,
        path: (parent ? parent + '.' : '') + k,
        model: v.ref
      }
    }
    //if (Object.prototype.toString.call(v) == '[object Array]' && v.length > 0 && v[0].ref && v[0].ref.search(/^\_|^Person$|^ActivityType$/) != -1) {
    if (Object.prototype.toString.call(v) == '[object Array]' && v.length > 0 && v[0].ref && v[0].ref.search(/^\_|^Person$/) != -1) {
      return {
        shortPath: k,
        path: (parent ? parent + '.' : '') + k,
        model: v[0].ref
      }
    }
  });
  treed = _.compact(treed);

  //this.map.push({
  this.maps[model.modelName].push({
    name: model.modelName,
    members: treed
  });

  if (treed.length > 0) {
    this.recurse(treed);
  }  

}

Inhabitant.prototype.recurse = function (models) {
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

Inhabitant.prototype.populateAll = function (modelName, filter, promise, DEBUG) {

  var time = process.hrtime();
  var model = this.models[modelName];
  var self = this;

  if (DEBUG) {
    if (!require('fs').existsSync(__dirname + '/DEBUG')) {
      require('fs').mkdirSync(__dirname + '/DEBUG', 0777);
    }
  }

  if (!this.maps[modelName]) {
    //Walk the nested document
    this.explore(model);
  }

  model.find(filter, function (err, arr) {
    
    async.mapSeries(arr, function (d, cb) {
      var options = {
        models: self.models,
        //modelName: modelName,
        callback: cb,
        data: d,
        map: self.maps[modelName],
        debug: (DEBUG ? true : false)
      };

      var populator = new Populator(options);

      populator.run();


    }, function (err, results) {

      if (self.debug)
        console.log('model: ' + modelName + '|count: ' + results.length + '|elapsed: ' + process.hrtime(time));

      if (promise) {
        promise(null, results);
      }
    });

  });

}

module.exports = Inhabitant;