var config = require('./config');
var express = require('express');
var app = express();
var fs = require('fs');
var bodyParser = require('body-parser');
var moment = require('moment');
var util = require('util');
var tz = require('moment-timezone');

var gcm = require('node-gcm');
var sender = new gcm.Sender(config.gcm_sender);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.set('superSecret', config.secret); 

var EXIT_GRACE_PERIOD = 30000; // milliseconds

var sqlite3 = require('sqlite3').verbose();
var db = new sqlite3.Database(':users:');
var loggedIn = false;

var hue = require("node-hue-api"),
    HueApi = hue.HueApi,
    lightState = hue.lightState;

var host = "192.168.1.136",
    username = config.hue_user,
    api = new HueApi(host, username);

var onState = lightState.create().turnOn();
var offState = lightState.create().turnOff();
var lightsArray = { };

var bleno = require('bleno');

var BlenoPrimaryService = bleno.PrimaryService;
var IpCharacteristic = require('./ip_characteristic');

bleno.on('stateChange', function(state) {
  if (state === 'poweredOn') {
    var uuid = 'FD5B667C-73C8-11E5-8BCF-FEFF819CDC9F'
    var major = 420;
    var minor = 710;
    var mtx = 0;

    log('About to start advertising....');
    bleno.startAdvertisingIBeacon(uuid, major, minor, mtx);
  }
});

bleno.on('advertisingStart', function(error) {
  log('on -> advertisingStart: ' + (error ? 'error ' + error : 'success'));

  if (!error) {
    bleno.setServices([
      new BlenoPrimaryService({
        uuid: '01010101010101010101010101010101',
        characteristics: [
          new IpCharacteristic()
        ]
      })
    ]);
  }
});

function lightsOn() {
  for (var i in lightsArray) {
    if (lightsArray[i].name
	.indexOf('Living') > -1 ||
        lightsArray[i].name 
        .indexOf('Kitchen') > -1) {
      setLightState(lightsArray[i].id, onState);
    }
  }
}

function lightsOff() {
  for (var i in lightsArray) {
    setLightState(lightsArray[i].id, offState);

  }
}

var failedCalls = {}
function setLightState(id, state) {
  api.setLightState(id, state, function(err, lights) {
    if (err) {
      log(err + " setting light " + id + ", will retry");
      failedCalls[id] = state;
    } else {
      log("set " + id + " -> " + state._values.on);
    }
  });
}


nest = require('unofficial-nest-api');
nest.login(config.nest_user, config.nest_pass, function (err, data) {
    if (err) {
        log(err.message);
        return;
    } else {
      loggedIn = true;
    }
});

db.serialize(function() {
  db.run('CREATE TABLE IF NOT EXISTS users (name TEXT NOT NULL, mac TEXT NOT NULL UNIQUE, status TEXT NOT NULL, room TEXT NOT NULL, lastBeat NUMBER, gcm_id TEXT NOT NULL)');
  fetchBulbs();
  dumpData();
  db.all('SELECT * FROM users', function(err, usersAll) {
    usersAll.forEach(function(user) {
      requestHeartBeatForUser(user.mac);
    });
  });
});

function fetchBulbs() {
  api.lights(function(err, lights) {
    if (err) throw err;
    for (var i in lights.lights) {
      var id = lights.lights[i].id;
      if (lights.lights[i].name.toString() != 'LightStrips') {
        lightsArray[id] = lights.lights[i];
      }
    }
  });
}

function dumpData() {
  if (!loggedIn) {
    log('Not logged into Nest');
    return;
  }

  nest.fetchStatus(function (data) {
    var now = new Date().getTime();
    for (var id in data.structure) {
      if (data.structure.hasOwnProperty(id)) {
        var structure = data.structure[id];

        db.all('SELECT mac FROM users WHERE status="true"', function(err, usersHome) {
          db.all('SELECT * FROM users', function(err, usersAll) {
            log(structure.name + " is currently " + (structure.away ? "away" : "home"));
            if (usersAll.length > 0) {
              if (usersHome.length == 0) {
                log("Nobody is home");
   	        if (!structure.away) {
		  sendMessageToAllUsers("Setting " + structure.name + " to away");
                  log("Setting " + structure.name + " to away");
		  nest.setAway(true);
                  lightsOff();
                }
              } else {
                log("Somebody is home");
      	        if (structure.away) {
                  sendMessageToAllUsers("Setting " + structure.name + " to home");
		  log("Setting " + structure.name + " to home");
                  nest.setAway(false);
	          lightsOn();
                }
              }
            }
             usersAll.forEach(function (user) {
              var time = now - user.lastBeat;
	      if (time > 60000 * 5) {
                log("havent seen " + user.name + " in " + time);
	        addItem(user.name, user.mac, false, user.room, user.gcm_id);
	      }

              if (time > 60000 * 15) {
                requestHeartBeatForUser(user.mac);
              }
            })
          })
        })
      }
    }
  });
}

app.get('/log/:length', function(req, res) {
  var token = req.body.token || req.query.token || req.headers['x-access-token'];
  if (token) {
    if (token = config.secret) {
      send_lines('/var/log/bluetooth_server.log', req.params.length, res);
    } else { 
      res.status(403).send({
        success: false,
        message: 'No token provided.'
      });
    }
  } else {
    res.status(403).send({ 
        success: false, 
        message: 'No token provided.' 
    });
  }
});

app.get('/check/:mac', function (req, res) {
  var token = req.body.token || req.query.token || req.headers['x-access-token'];
  if (token) {
    if (token = config.secret) {
      var found = false;
      db.all('SELECT * FROM users WHERE mac="' + req.params.mac + '"', function(err, rows) {
        if (rows.length > 0) {
          res.send(rows[0].name);
        } else {
          res.send(false);
        }
      });
    } else { 
      res.status(403).send({
        success: false,
        message: 'No token provided.'
      });
    }
  } else {
    res.status(403).send({
        success: false,
        message: 'No token provided.'
    });
  }
});

app.get('/roommates', function (req, res) {
  var token = req.body.token || req.query.token || req.headers['x-access-token'];
  if (token) {
    if (token = config.secret) {
      db.all('SELECT * FROM users', function(err, rows) {
        if (rows.length > 0) {
          res.send(JSON.stringify(rows));
        } else {
          res.send(false);
        }
      });
    } else {
      res.status(403).send({
        success: false,
        message: 'No token provided.'
      });
    }
  } else {
    res.status(403).send({
        success: false,
        message: 'No token provided.'
    });
  }


});

app.post('/heartbeat', function (req, res) {
  var token = req.body.token || req.query.token || req.headers['x-access-token'];
  if (token) {
    if (token = config.secret) {
      if (req.body.name != null &&
          req.body.mac != null &&
          req.body.status != null &&
          req.body.room != null &&
          req.body.gcm != null) {
        addItem(req.body.name, req.body.mac, req.body.status, req.body.room, req.body.gcm);
        res.sendStatus(200);
      } else {
        res.send(400);
      }
    } else {
      res.status(403).send({
        success: false,
        message: 'No token provided.'
      });
    }
  } else {
    res.status(403).send({
        success: false,
        message: 'No token provided.'
    });
  }
});

app.post('/register', function (req, res) {
  var token = req.body.token || req.query.token || req.headers['x-access-token'];
  if (token) {
    if (token = config.secret) {
      addItem(req.body.name, req.body.mac, "", "", req.body.gcm);
      res.sendStatus(200);
    } else {
      res.status(403).send({
        success: false,
        message: 'No token provided.'
      });
    }
  } else {
    res.status(403).send({
        success: false,
        message: 'No token provided.'
    });
  }
});

function addItem(name, mac, status, room, gcm) {
  log("new data : [" + name + " : " + mac + " : " + status + " : " + room + " : " + gcm + "]");
  var stmt = db.prepare('INSERT OR REPLACE INTO users VALUES (?, ?, ?, ?, ?, ?)');
  stmt.run(name, mac, status, room, new Date().getTime(), gcm);
  stmt.finalize();
}

var server = app.listen(3000, function () {
  var host = server.address().address;
  var port = server.address().port;

  log(util.format('App listening at %s:%s', host, port));
});

setInterval(function() {
  dumpData();

  for (var i in failedCalls) {
    setLightState(i, failedCalls[i])
  }

  failedCalls = {};

}, EXIT_GRACE_PERIOD / 2);

function log(data) {
  var timeStamp = moment(moment()).tz('America/New_York').format('MMMM Do YYYY, h:mm:ss a');
  console.log(timeStamp + " - " + data);
  fs.appendFile('/var/log/bluetooth_server.log', timeStamp + " - " +  data + "\n", null);
}

require('shutdown-handler').on('exit', function(e) {
  e.preventDefault();
});

function inspect(data) {
  log(util.inspect(data, { showHidden: true, depth: null }))
}

function requestHeartBeatForUser(mac) {
  var message = new gcm.Message();
  message.addData('action', 'request_beat');
        
  var ids = [];

  db.all('SELECT * FROM users WHERE mac="' + mac + '"', function(err, usersAll) {
    log(mac + " : length " + usersAll.length);
    usersAll.forEach(function(user) {
      log(user.name + " : id = "  + user.gcm_id);
      ids.push(user.gcm_id);
    });

    sender.send(message, { registrationIds: ids });
  });
}

function sendMessageToUser(mac, messageData) {
  var message = new gcm.Message();
  message.addData('action', 'message');
  message.addData('message_content', messageData);

  var ids = [];  message.addData('action', 'message');

  db.all('SELECT * FROM users WHERE mac="' + mac + '"', function(err, usersAll) {
    usersAll.forEach(function(user) {
      log(user.name + " : id = "  + user.gcm_id);
      ids.push(user.gcm_id);
    });

    sender.send(message, { registrationIds: ids });
  });
}

function sendMessageToAllUsers(messageData) {
  var message = new gcm.Message();
  message.addData('action', 'message');
  message.addData('message_content', messageData);

  var ids = [];  message.addData('action', 'message');

  db.all('SELECT * FROM users', function(err, usersAll) {
    usersAll.forEach(function(user) {
      log(user.name + " : id = "  + user.gcm_id);
      ids.push(user.gcm_id);
    });

    sender.send(message, { registrationIds: ids });
  });
}

function send_lines(filename, line_count, res) {
    var data = fs.readFileSync(filename, 'utf8');
    var lines = data.split("\n");

    var result = '';
    for (var i=line_count; i>=0; i--) {
      result = result + "\n" + lines[(lines.length - i)];
    }
   res.send(result);
}
