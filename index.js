var config = require('./config');
var fs = require('fs');
exports.fs = fs;

var marvin_utils = require('./marvin_utils.js');
var util = marvin_utils.util;

var watch = require('watch')
var exec = require('child_process').exec;

var sqlite3 = require('sqlite3').verbose();
var db = new sqlite3.Database(':users:');

var hue_controller = require('./hue_controller.js');
var hue_controller_instance;
var roomMap = {};

var bleno = require('bleno');
var bleno_controller = require('./bluetooth_controller.js');

var gcm_controller = require('./gcm_controller.js');
var express_controller = require('./express_controller.js');

var nest_controller = require('./nest_controller.js');
var my_q_controller = require('./my_q_controller.js');

var passport = require('passport-google-id-token');

var awayCount = 0;

var ADMIN_ID = '101541075248187016246';

var domain = require('domain');
var d = domain.create();
d.on('error', function(err) {
  marvin_utils.error(err.stack +  " : " + err);
});

bleno.on('stateChange', function(state) {
  bleno_controller.on(state);
});

bleno.on('advertisingStart', function(error) {
  bleno_controller.on('advertisingStart');
});

db.serialize(function() {
 //clear rooms
// db.run('DROP TABLE IF EXISTS users');

 sendAdminMessage('Marvin is waking up');
 db.run('CREATE TABLE IF NOT EXISTS users (profile_id TEXT NOT NULL UNIQUE, name TEXT NOT NULL, email TEXT NOT NULL, status TEXT NOT NULL, room TEXT NOT NULL, lastBeat NUMBER, gcm_id TEXT NOT NULL, enable_tracking NUMBER NOT NULL)');
 db.run('CREATE TABLE IF NOT EXISTS devices (id TEXT NOT NULL UNIQUE, name TEXT NOT NULL, type TEXT NOT NULL)');
 db.run('CREATE TABLE IF NOT EXISTS rooms (room_name TEXT NOT NULL UNIQUE, mac_list TEXT NOT NULL, device_ids TEXT NOT NULL)');

 my_q_controller.setupNightlyClosure();
 nest_controller.logIn();
    nest_controller.setAway(false);

 hue_controller_instance = new hue_controller(db);
 express_controller_instance = new express_controller(db, hue_controller_instance);
 startWatch();
 
 db.all('SELECT * FROM users', function(err, usersAll) {
    usersAll.forEach(function(user) {
      requestHeartBeatForUser(user.profile_id);
    });
  });

  db.all('SELECT * FROM rooms', function(err, rooms) {
    rooms.forEach(function(room) {
      marvin_utils.inspect(room);
    });
  });
});

function handleSomebodyHome(structure) {
  awayCount = 0;
  if (structure.away) {
    sendMessageToAllUsers("Setting " + structure.name + " to home");
    marvin_utils.log("Setting " + structure.name + " to home");
    nest_controller.setAway(false);
    hue_controller_instance.allOnForHome();
  }
}

function handleNobodyHome(structure) {
  if (!structure.away) {
    if (awayCount > 5) {
      sendMessageToAllUsers("Setting " + structure.name + " to away");
      marvin_utils.log("Setting " + structure.name + " to away");
      nest_controller.setAway(true);
      hue_controller_instance.allOff();
      my_q_controller.closeDoor();
    } else {
      awayCount++;
      marvin_utils.log("Away for " + awayCount + " cycles.")
    }
  }
}

function dumpData() {
  if (!nest_controller.loggedIn) {
    marvin_utils.log('Not yet logged into Nest');
    return;
  }

  nest_controller.fetchStatus(function (data) {
    var now = new Date().getTime();
    for (var id in data.structure) {
      if (data.structure.hasOwnProperty(id)) {
        var structure = data.structure[id];

        db.all('SELECT profile_id FROM users WHERE status="true"', function(err, usersHome) {
          db.all('SELECT * FROM users', function(err, usersAll) {
            marvin_utils.log(structure.name + " is currently " + (structure.away ? "away" : "home"));
            if (usersAll.length > 0) {
              if (usersHome.length == 0) {
		handleNobodyHome(structure);
              } else {
		handleSomebodyHome(structure);
                marvin_utils.log("Somebody is home");
      	        if (structure.away) {
                  sendMessageToAllUsers("Setting " + structure.name + " to home");
		  marvin_utils.log("Setting " + structure.name + " to home");
                  nest_controller.setAway(false);
                }
              }
            }
            usersAll.forEach(function (user) {
              var time = now - user.lastBeat;
              if (time > 1000 * 60 * 15) {
                marvin_utils.log("Requesting heartbeat from " + user.name);
                requestHeartBeatForUser(user.profile_id);
              }
            })
          })
        })
      }
    }
  });
}

exports.sendAdminMessage = function adminMessage(msg) {
  sendAdminMessage(msg);
}

function sendAdminMessage(msg) {
 marvin_utils.log(ADMIN_ID + " : " + msg);
 if (ADMIN_ID) { 
   sendMessageToUser(ADMIN_ID, msg);
 }
}

exports.toggleRoom = function toggle(user) {
  var room = roomMap[user];
  
  db.all('SELECT * FROM rooms WHERE room_name LIKE "%' + room + '%"', function(err, rooms) {
    marvin_utils.inspect(rooms);
    rooms.forEach(function(room) {
      var devices = room.device_ids.split('&');
      for (var i=0;i<devices.length;i++) {
 	if (devices[i]) {
          hue_controller_instance.toggleLight(devices[i]);
        }
      }   
    })
  })
}

exports.addRoom = function add(room_name, devices, beacons) {
  addRoom(room_name, devices, beacons);
}

function addRoom(room_name, devices, beacons) {
  var stmt = db.prepare('INSERT OR REPLACE INTO rooms VALUES (?, ?, ?)');

  var deviceEntry = "";
  for (var i=0;i<devices.length;i++) {
    marvin_utils.inspect(devices[i]);
    deviceEntry = deviceEntry + "&" + devices[i].id;
  }

  var beaconEntry = "";
  for (var i=0;i<beacons.length;i++) {
    marvin_utils.inspect(beacons[i]);
    beaconEntry = beaconEntry + "&" + beacons[i].mac + "|" + beacons[i].uuid;
  }

  stmt.run(room_name, beaconEntry, deviceEntry);
  stmt.finalize();
}

exports.addItem = function add(profile_id, name, email, status, room, gcm, enable_tracking) {
  addItem(profile_id, name, email, status, room, gcm, enable_tracking);
}

function handleUserChangedRooms(oldRoom, room) {
  marvin_utils.inspect(room);
  marvin_utils.inspect(oldRoom);
  db.all('SELECT * FROM users WHERE room="' + oldRoom + '"', function(err, usersInRoom) {
    if (usersInRoom.length == 1) {
      setRoomToState(oldRoom, hue_controller_instance.offState());
    }
  });

  db.all('SELECT * FROM users WHERE room="' + room + '"', function(err, usersInRoom) {
    if (usersInRoom.length == 0) {
      setRoomToState(room, hue_controller_instance.onState());
    }
  });
}

function setRoomToState(room, state) {
  db.all('SELECT * FROM rooms WHERE room_name LIKE "%' + room + '%"', function(err, rooms) {
    marvin_utils.inspect(rooms);
    rooms.forEach(function(room) {
      var devices = room.device_ids.split('&');
      for (var i=0;i<devices.length;i++) {
        hue_controller_instance.setLightState(devices[i], state);
      }
    })
  })
}

function addItem(profile_id, name, email, status, room, gcm, enable_tracking) {
  var oldRoom = roomMap[name];
  roomMap[name] = room;
  if (oldRoom !== room && enable_tracking == 1) {
    marvin_utils.log(name + " from " + oldRoom + " to " + room);
    handleUserChangedRooms(oldRoom, room);
  }
  
  var stmt = db.prepare('INSERT OR REPLACE INTO users VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  stmt.run(profile_id, name, email, status, room, new Date().getTime(), gcm, enable_tracking);
  stmt.finalize();
}

setInterval(function() {
  dumpData();
}, 5000);

function requestHeartBeatForUser(profile_id) {
  var ids = [];

  db.all('SELECT * FROM users WHERE profile_id="' + profile_id + '"', function(err, usersAll) {
    if (err) {
      marvin_utils.log(err);
    }
    usersAll.forEach(function(user) {
      ids.push(user.gcm_id);
    });

    gcm_controller.requestBeat({ registrationIds: ids });
  });
}

function sendMessageToUser(profile_id, messageData) {
  var ids = [];
  db.all('SELECT * FROM users WHERE profile_id="' + profile_id + '"', function(err, usersAll) {
    if (usersAll) {
      usersAll.forEach(function(user) {
        ids.push(user.gcm_id);
      });

      gcm_controller.sendMessage(messageData, { registrationIds: ids });
    }
  });
}

function sendMessageToAllUsers(messageData) {
  var ids = [];
  db.all('SELECT * FROM users', function(err, usersAll) {
    usersAll.forEach(function(user) {
      ids.push(user.gcm_id);
    });

    gcm_controller.sendMessage(messageData, { registrationIds: ids });
  });
}

function startWatch() {
  watch.watchTree('/Library/Server/Web/Data/Sites/marvin.boldlygoingnowhere.org/marvin_android/', function (f, curr, prev) {
    if (typeof f == "object" && prev === null && curr === null) {
    } else if (prev === null) {
      var split = f.split("/");
      var l = split.length;
      sendUpdateMessage(split[l-3] + "/" + split[l-2] + "/"+ split[l-1]) ;
    }
  })
}

function sendUpdateMessage(messageData) {
  var ids = [];

  db.all('SELECT * FROM users', function(err, usersAll) {
    usersAll.forEach(function(user) {
      marvin_utils.log("alerting " +user.name + " : id = "  + user.gcm_id + " to update at " + messageData);
      ids.push(user.gcm_id);
    });

    gcm_controller.sendUpdate(messageData, { registrationIds: ids });
  });
}
