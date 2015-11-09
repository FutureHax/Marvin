var config = require('./config');
var marvin_utils = require('./marvin_utils.js');

var hue = require("node-hue-api"),
    HueApi = hue.HueApi,
    lightState = hue.lightState;

var host = "192.168.1.136",
    username = config.hue_user,
    api = new HueApi(host, username);

var onState = lightState.create().turnOn();
var offState = lightState.create().turnOff();
var lightsArray = {};
var failedCalls = {}
var database;
var roomToLightMap = {};

Controller.prototype.onState = function() {
  return onState;
};

Controller.prototype.offState = function() {
  return offState;
};

Controller.prototype.setAway = function(status) {
  setAway(status);
};

Controller.prototype.lightsArray = function() {
  return lightsArray;
}

var allOn = function() {
  for (var i in lightsArray) {
    if (lightsArray[i].name
        .indexOf('Living') > -1 ||
        lightsArray[i].name
        .indexOf('Kitchen') > -1) {
      setLightState(lightsArray[i].id, onState);
    }
  }
  return "on";
}

Controller.prototype.allOff = function allOff() {
  for (var i in lightsArray) {
    setLightState(lightsArray[i].id, offState);
  }
}

Controller.prototype.allOn = function allOn() {
  for (var i in lightsArray) {
    setLightState(lightsArray[i].id, onState);
  }
}

Controller.prototype.setLightState = function setLight(id, state) {
  setLightState(id, state);
}

function setLightState(id, state) {
  if (id) {
    api.setLightState(id, state, function(err, lights) {
      if (err) {
        marvin_utils.log(err + " setting light " + id + ", will retry");
        failedCalls[id] = state;
      } else {
        marvin_utils.log("set " + id + " -> " + state._values.on);
      }
    });
  }
}

function fetchBulbs() {
  api.lights(function(err, lights) {
    if (err) throw err;
    for (var i in lights.lights) {
      var id = lights.lights[i].id;
      if (lights.lights[i].name.toString() != 'LightStrips') {
        lightsArray[id] = lights.lights[i];
      }
      var stmt = database.prepare('INSERT OR REPLACE INTO devices VALUES (?, ?, ?)');
      stmt.run(id, lights.lights[i].name, lights.lights[i].type);
      stmt.finalize();
      marvin_utils.log('saved bulb, ' + lights.lights[i].name);
    }
  });
}

Controller.prototype.toggleLight = function toggleLight(id) {
  marvin_utils.log(id);
  api.lightStatus(id, function(err, result) {
    if (result) {
      if (!result.state.on) {
        setLightState(id, onState);
      } else {
        setLightState(id, offState);
      }
    } else {
      marvin_utils.log(err);
    }
  });
}

setInterval(function() {
  for (var i in failedCalls) {
    setLightState(i, failedCalls[i])
  }
  failedCalls = {};
}, 1000);

function Controller(db) {
  database = db;
  fetchBulbs();
}

module.exports = Controller;
