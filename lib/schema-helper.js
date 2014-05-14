var _ = require('underscore'),
  mongoose = require('mongoose'),
  fs = require('fs');

var evalJSTypes = {

  "String": String,
  "Boolean": Boolean,
  "Number": Number,
  "Date": Date

}

function convertToJSType(json) {

  for (var x in json) {

    if (typeof json[x] === 'object') {
      convertToJSType(json[x]);
    } else {

      if (x == 'type' && evalJSTypes[json[x]]) {
        json[x] = evalJSTypes[json[x]];
      }
    }

  }
}

/*

The file name is the model name.
Each file content looks like something this:

{
  "schema": {
    "id": {
      "type": "String",
      "default": ""
    },
    "modelAttribute1": {
      "type": "String",
      "ref": "Model1"
    },
    "modelAttribute2": {
      "type": "String",
      "ref": "Model2"
    },
    "arrayOfModelAttribute3": [{
      "type": "String",
      "ref": "Model3"
    }]
  }
}

*/
exports.loadSchemas = function (folder) {

  var files = fs.readdirSync(folder);

  var m = _.reduce(files, function (memo, f) {
    var content = fs.readFileSync(folder + '/' + f, {
      encoding: 'utf8'
    });
    var json = JSON.parse(content);

    convertToJSType(json.schema);

    //Explicitly declare _id as type String; default is ObjectId()
    json.schema._id = String;

    var schema = mongoose.Schema(json.schema);
    var modelName = f.replace(/\.json$/, '');
    var model = mongoose.model(modelName, schema);

    memo[modelName] = model;
    return memo;
  }, {});

  return m;

}