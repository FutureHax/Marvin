var config = require('./config');
var myQ = require('myqnode').myQ;
var Promise = require('es6-promise').Promise
var schedule = require('node-schedule');
var marvin_utils = require('./marvin_utils.js');

exports.openDoor = function open() {
  openDoor();
}

exports.closeDoor = function close() {
  closeDoor();
}

exports.setupNightlyClosure = function get() { 
  var rule = new schedule.RecurrenceRule();
  rule.dayOfWeek = [new schedule.Range(0, 6)];
  rule.hour = 23;
  rule.minute = 00;
  var j = schedule.scheduleJob(rule, function(){
    closeDoor();
  });
}

function closeDoor() {
  marvin_utils.log('Shutting garage door!');
  myQ.closeDoor(config.my_q_email, config.my_q_pass, config.my_q_device)
    .then(function(state){
      marvin_utils.log("Sucessfully Closed Door,"+state);
    },
    function(state){
      marvin_utils.log("Error Closing Door",+state);
    }
  );
}

function openDoor() {
  marvin_utils.log('Opening garage door!');
  myQ.openDoor(config.my_q_email, config.my_q_pass, config.my_q_device)
    .then(function(state){
      marvin_utils.log("Sucessfully Opened Door,"+state);
    },
    function(state){
      marvin_utils.log("Error Opening Door",+state);
    }
  );
}
