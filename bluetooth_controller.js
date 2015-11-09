var bleno = require('bleno');
var marvin_utils = require('./marvin_utils.js');

var BlenoPrimaryService = bleno.PrimaryService;
var IpCharacteristic = require('./ip_characteristic');

exports.on = function(state) {
  if (state === 'poweredOn') {
    var uuid = 'FD5B667C-73C8-11E5-8BCF-FEFF819CDC9F'
    var major = 420;
    var minor = 710;
    var mtx = -62;

    marvin_utils.log('About to start advertising....');
    bleno.startAdvertisingIBeacon(uuid, major, minor, mtx);
  } else if (state === 'advertisingStart') {
    marvin_utils.log('on -> advertisingStart');
    bleno.setServices([
      new BlenoPrimaryService({
        uuid: '01010101010101010101010101010101',
        characteristics: [
          new IpCharacteristic()
        ]
      })
    ]);
  }
};
