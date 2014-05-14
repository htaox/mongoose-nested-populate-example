var async = require('async'),
  _ = require('underscore'),
  schemaHelper = require('./schema-helper')

function Inhabitant(config) {

  this.config = config;
  //Please see schema-helper.js to see what this.models looks like
  this.models = schemaHelper.loadSchemas(config.schemasFolder);
};

Inhabitant.prototype.populateAll = function (modelName, filter, promise) {

  var counter = 0;
  var loaded = {};
  var map = [];
  var model = this.models[modelName];

  var time = process.hrtime();
  var self = this;

  function explore(model, parent) {

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

    map.push({
      name: model.modelName,
      members: treed
    });

    if (treed.length > 0) {
      recurse(treed);
    }

  }

  /*!
    Sometimes, a deep model may have a child referencing its parent.
	When this happens, we will recurse indefinitely and the stack will max out.
	So we will visit a type only once.	
  */
  function recurse(models) {

    _.each(models, function (d) {
      if (!loaded[d.model]) {
        loaded[d.model] = 1;
        explore(self.models[d.model], d.path);
      } else {
        loaded[d.model] += 1;
      }
    });

  }

  /*
  Start building the FULL paths for each level of the nested document.
  */
  explore(model);

  model.findOne(filter, function (err, d) {

    if (err && promise) {
      return promise(err);
    }

	/*!
      The key to recursively populating deeply nested documents is to do it in a serial manner.
	  The parent must be populated before the child.
    */
    async.eachSeries(map, function (m, next) {

      self.models[m.name].populate(d, m.members, function (err, d) {
        if (!err) {
          next(null, d);
        } else {
          next(err);
        }
      });

    }, function (err) {

      console.log('Done in ' + process.hrtime(time));

      if (promise) {
        promise(err, d);
      }

    });

  });

}

module.exports = Inhabitant;