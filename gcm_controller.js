var config = require('./config');
var gcm = require('node-gcm');
var sender = new gcm.Sender(config.gcm_sender);

exports.requestBeat = function beat(ids) {
  var message = new gcm.Message();
  message.addData('action', 'request_beat');
  sender.send(message, { registrationIds: ids });
}

exports.sendUpdate = function beat(ids, messageData) {
  var message = new gcm.Message();
  message.addData('action', 'update');
  message.addData('url', messageData);

  sender.send(message, { registrationIds: ids });
}


exports.sendMessage = function beat(messageData, ids) {
  var message = new gcm.Message();
  message.addData('action', 'message');
  message.addData('message_content', messageData);
  sender.send(message, { registrationIds: ids });
}
