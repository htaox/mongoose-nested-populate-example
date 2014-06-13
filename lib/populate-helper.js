var async = require('async'),
  _ = require('underscore'),
  schemaHelper = require('./schema-helper')

function Populator(config) {
  this.map = config.map;
  this.models = config.models;
  this.data = config.data;
  this.callback = config.callback;
  this.debug = config.debug;
}

Populator.prototype.run = function () {

  var self = this;

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
    this.loaded[model.modelName] = {};
  }
  
  var tree = model.schema.tree;

  var treed = _.map(tree, function (v, k) {

    if (v.ref) {
      return {
        shortPath: k,
        path: (parent ? parent + '.' : '') + k,
        model: v.ref
      }
    }
    
    if (Object.prototype.toString.call(v) == '[object Array]' && v.length > 0 && v[0].ref) {
      return {
        shortPath: k,
        path: (parent ? parent + '.' : '') + k,
        model: v[0].ref
      }
    }
  });
  treed = _.compact(treed);

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
    if (!self.loaded[self.modelName][d.model]) {
      self.loaded[self.modelName][d.model] = 1;
      self.explore(self.models[d.model], d.path);
    } else {
      self.loaded[self.modelName][d.model] += 1;
    }    
  });

}

Inhabitant.prototype.populateAll = function (modelName, filter, options, promise, DEBUG) {

  /*
    modelName: mongoose model name
    filter: mongo find filter.  ie { "_id": "123"}
    options: mongo find options  ie { "skip": 4000, "limit": 1000 }
    promise: callback to call when done.  Typically, function(null, results) as in async lib.
    DEBUG: if true, write to disk
  */

  var time = process.hrtime();
  var model = this.models[modelName];
  var self = this;

  this.modelName = modelName;

  if (DEBUG) {
    if (!require('fs').existsSync(__dirname + '/DEBUG')) {
      require('fs').mkdirSync(__dirname + '/DEBUG', 0777);
    }
  }

  if (!this.maps[modelName]) {
    this.explore(model);
  }

  /* limit populate to 1000 documents */
  if (!options){
    options = { limit: 1000 };
  }

  var maps = _.reduce(this.maps, function(memo, v, k) {
    memo.push(v[0]);
    return memo;
  }, []);

  model.find(filter, null, options, function (err, arr) {
    
    async.mapSeries(arr, function (d, cb) {
      var options = {
        models: self.models,
        callback: cb,
        data: d,
        map: maps,
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