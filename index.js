var mongoose = require('mongoose')
Inhabitant = require('./lib/populate-helper.js'),
flatten = require('flat').flatten,
fs = require('fs'),
config = require('../config'); //Create your own config file

mongoose.connect('mongodb://' + config.mongoServer + '/studies');

var db = mongoose.connection;
db.once('open', function callback() {

  var inhabitant = new Inhabitant(config),
    modelName = 'YourModelName',
    promise = function (err, d) {

      if (err) {
        throw err;
      }

      //Write it out, testing only
      var outTest = __dirname + '/out-test';
      if (!fs.existsSync(outTest)) {
        fs.mkdirSync(outTest, 0777);
      }
      fs.writeFileSync(outTest + '/populated.json', JSON.stringify(d, null, '  '), {
        encoding: 'utf8'
      });
      fs.writeFileSync(outTest + '/populated-flattened.json', JSON.stringify(flatten(d.toJSON()), null, '  '), {
        encoding: 'utf8'
      });

      process.exit(0);

    }

  //Start the test
  inhabitant.populateAll(modelName, {}, promise);

});