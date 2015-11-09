var config = require('./config');
var root = require('./index.js');
var fs = root.fs;
var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var marvin_utils = require('./marvin_utils.js');
var util = marvin_utils.util;
var exec = require('child_process').exec;
var hue_controller;
var EventEmitter = require('events').EventEmitter;

var database;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.set('superSecret', config.secret);

var multer = require('multer');
var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/' + req.body.uploader)
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "_" + file.originalname)
  }
})
 
var upload = multer({ storage: storage })
var cpUpload = upload.single('photo');
app.post('/upload', cpUpload, function(req,res){
  res.sendStatus(200);
});

app.post('/speak', function(req, res) {
  exec('say ' + req.body.say);
});

app.get('/log/:length', function(req, res) {
  var token = req.body.token || req.query.token || req.headers['x-access-token'];
  if (token) {
    if (token = config.secret) {
      sendLines('/var/log/bluetooth_server.log', req.params.length, res);
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

app.get('/log/:length', function(req, res) {
  var token = req.body.token || req.query.token || req.headers['x-access-token'];
  if (token) {
    if (token = config.secret) {
      sendLines('/var/log/bluetooth_server.log', req.params.length, res);
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

function cleanArray(actual){
  var newArray = new Array();
  for(var i = 0; i<actual.length; i++){
      if (actual[i]){
        newArray.push(actual[i]);
    }
  }
  return newArray;
}

app.get('/getRooms/', function (req, res) {
  var token = req.body.token || req.query.token || req.headers['x-access-token'];

  function UberRoom(name, beacons, devices) {
    EventEmitter.call(this);
    this._name = name;
    this._beaconsArray = [];
    this._devices = devices;
    this._devicesArray = [];
    
    var bSplit = beacons.split("&");
    bSplit = cleanArray(bSplit);
    
    var dSplit = devices.split("&");
    dSplit = cleanArray(dSplit);

    for (var i=0;i<bSplit.length;i++) {
      var ids = bSplit[i].split("|");

      var beaconId = {
        mac: ids[0],
        uuid: ids[1]
      }
      marvin_utils.log(bSplit[i]);
      this._beaconsArray.push(beaconId);
    }

    var room = this;
    for (var i=0;i<dSplit.length;i++) {
      database.all('SELECT * FROM devices WHERE id="' + dSplit[i] + '"', function(err, devices) {
        if (devices[0]) {
          room._devicesArray.push(devices[0]);
          if (room._devicesArray.length === devices.length) {
            room.emit('loaded');
          }
        }
      });
    }
  };

  util.inherits(UberRoom, EventEmitter);

  if (token) {
    if (token = config.secret) {
      database.all('SELECT * FROM rooms', function(err, rooms) {
        var uberRooms = [];
        rooms.forEach(function(room) {
          marvin_utils.inspect(room);
          var uberRoom = module.exports = new UberRoom(
                             room.room_name, 
                             room.mac_list,
			     room.device_ids);          
          uberRoom.on('loaded', function(){
            uberRooms.push(uberRoom);
	    if (uberRooms.length === rooms.length) {
              res.send(JSON.stringify(uberRooms));
	    }
          });
        });
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

app.get('/devices', function (req, res) {
  var token = req.body.token || req.query.token || req.headers['x-access-token'];
  if (token) {
    if (token = config.secret) {
      res.send(JSON.stringify(hue_controller.lightsArray()));
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
      database.all('SELECT * FROM users', function(err, rows) {
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

app.post('/addRoom', function (req, res) {
  var token = req.body.token || req.query.token || req.headers['x-access-token'];
  if (token) {
    if (token = config.secret) {
      root.addRoom(req.body.name, req.body.devices, req.body.beacons);
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

app.post('/toggle/', function (req, res) {
  var token = req.body.token || req.query.token || req.headers['x-access-token'];
  if (token) {
    if (token = config.secret) {
      root.toggleRoom(req.body.user);
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

app.post('/heartbeat', function (req, res) {
  var token = req.body.token || req.query.token || req.headers['x-access-token'];
  if (token) {
    if (token = config.secret) {
      marvin_utils.inspect(req.body);
      if (req.body.name != null &&
          req.body.profile_id != null &&
          req.body.email != null &&
          req.body.status != null &&
          req.body.room != null &&
          req.body.gcm != null) {
        root.addItem(req.body.profile_id, req.body.name, req.body.email, req.body.status, req.body.room, req.body.gcm);
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
      fs.existsSync("uploads/" + req.body.profile_id) || fs.mkdirSync("uploads/" + req.body.profile_id);
      root.addItem(req.body.profile_id, req.body.name, req.body.email, "", "", req.body.gcm);
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

function sendLines(filename, line_count, res) {
    var data = fs.readFileSync(filename, 'utf8');
    var lines = data.split("\n");

    var result = '';
    for (var i=line_count; i>=0; i--) {
      result = result + "\n" + lines[(lines.length - i)];
    }
   res.send(result);
}

function Controller(db, hue) {
  database = db;
  hue_controller = hue;
  app.listen(3000, function () {
    marvin_utils.log('Server live');
  });
}

module.exports = Controller;

