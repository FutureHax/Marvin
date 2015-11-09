var config = require('./config');
var nest = require('unofficial-nest-api');
var marvin_utils = require('./marvin_utils.js');
var domain = require('domain');

var d = domain.create();
d.on('error', function(err) {
  marvin_utils.error(err.stack + " : " + err);
});

var isLoggedIn = false;
exports.loggedIn = function() {
  marvin_utils.log(isLoggedIn);
  return isLoggedIn;
};

exports.setAway = function(status) {
  setAway(status);
};

exports.fetchStatus = function(callback) {
  fetchStatus(callback);
};

exports.logIn = function() {
  login();
};

function setAway(status) {
  if (isLoggedIn) {
    d.run(function() {
      nest.setAway(status);
    });
  }
};

function fetchStatus(callback) {
  d.run(function() {
    if (isLoggedIn) {
     nest.fetchStatus(callback);
    }
  });
};

function login() {
  d.run(function() {
    nest.login(config.nest_user, config.nest_pass, function (err, data) {
      marvin_utils.log('Logged into Nest');
      isLoggedIn = true;
      fetchStatus();
    });
  });
};
