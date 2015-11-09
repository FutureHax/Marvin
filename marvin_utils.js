var util = require('util');
var fs = require('fs');
var moment = require('moment');
var tz = require('moment-timezone');

exports.util = util;

exports.inspect = function inspect(data) {
  log(util.inspect(data, { showHidden: true, depth: null }))
}

exports.log = function l(data) {
  log(data);
}

log = function(data) {
  var timeStamp = moment(moment()).tz('America/New_York').format('MMMM Do YYYY, h:mm:ss a');
  console.log(timeStamp + " - " + data);
  fs.appendFile('/var/log/bluetooth_server.log', timeStamp + " - " +  data + "\n", null);
}

exports.error = function e(data) {
  log('\n----------ERROR----------\n ' + data + '\n----------ERROR----------');
}

log = function(data) {
  var timeStamp = moment(moment()).tz('America/New_York').format('MMMM Do YYYY, h:mm:ss a');
  console.log(timeStamp + " - " + data);
  fs.appendFile('/var/log/bluetooth_server.log', timeStamp + " - " +  data + "\n", null);
}
