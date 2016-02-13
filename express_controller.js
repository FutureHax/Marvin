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
var passport = require('passport');
var GoogleTokenStrategy = require('passport-google-id-token');

var database;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(user, done) {
  done(null, user);
});

passport.use(new GoogleTokenStrategy({
    clientID: config.google_client_id,
    clientSecret: config.google_client_secret
  },
  function(parsedToken, googleId, done) {
    fs.existsSync("uploads/" + googleId) || fs.mkdirSync("uploads/" + googleId);
    done(null, googleId);
  }
));

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

app.post('/speak',
  passport.authenticate('google-id-token'),
  function(req, res) {
    exec('say ' + req.body.say);
  }
);

app.post('/log/:length', 
  passport.authenticate('google-id-token'),
  function(req, res) {
    sendLines('/var/log/bluetooth_server.log', req.params.length, res);
  }
);

function cleanArray(actual){
  var newArray = new Array();
  for(var i = 0; i<actual.length; i++){
      if (actual[i]){
        newArray.push(actual[i]);
    }
  }
  return newArray;
}

app.post('/getRooms/', 
  passport.authenticate('google-id-token'),
  function (req, res) {
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
       })
    })
  })
});

app.post('/devices',
 passport.authenticate('google-id-token'),
 function (req, res) {
      res.send(JSON.stringify(hue_controller.lightsArray()));
  }
);

app.post('/roommates', 
 passport.authenticate('google-id-token'),
 function (req, res) {
   database.all('SELECT * FROM users', function(err, rows) {
     if (rows.length > 0) {
       res.send(JSON.stringify(rows));
     } else {
       res.send(false);
     }
   })  
 }
);

app.post('/addRoom', 
 passport.authenticate('google-id-token'),
 function (req, res) {
   root.addRoom(req.body.name, req.body.devices, req.body.beacons);
   res.sendStatus(200);
 }
);

app.post('/toggle/', 
 passport.authenticate('google-id-token'),
 function (req, res) {
   root.toggleRoom(req.body.user);
   res.sendStatus(200);
 }
);

app.post('/heartbeat', 
  passport.authenticate('google-id-token'),
  function (req, res) {
    marvin_utils.inspect(req.body);
      if (req.body.name != null &&
        req.body.profile_id != null &&
        req.body.email != null &&
        req.body.status != null &&
        req.body.room != null &&
        req.body.gcm != null &&
        req.body.enable_tracking != null) {
          root.addItem(req.body.profile_id, req.body.name, req.body.email, req.body.status, req.body.room, req.body.gcm, req.body.enable_tracking);
          res.sendStatus(200);
      }
  }
);

app.post('/register', 
  passport.authenticate('google-id-token'),
  function (req, res) {
      root.addItem(req.body.profile_id, req.body.name, req.body.email, "", "", req.body.gcm, req.body.enable_tracking);
      res.sendStatus(200);
  }
);

function sendLines(filename, line_count, res) {
    var data = fs.readFileSync(filename, 'utf8');
    var lines = data.split("\n");

    var result = '';
    for (var i=line_count; i>=0; i--) {
      var line = lines[(lines.length - i)];
      if (line) {
        result = result + "\n" + line;
      }
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

