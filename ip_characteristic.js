var util = require('util');

var bleno = require('bleno');

var BlenoCharacteristic = bleno.Characteristic;
var BlenoDescriptor = bleno.Descriptor;
var ip = require('ip');
var current_ip = ip.address();

function IpCharacteristic(ip) {
  IpCharacteristic.super_.call(this, {
    uuid: '01010101010101010166616465524742',
    properties: ['read'],
    descriptors: [
      new BlenoDescriptor({
        uuid: '2901',
        value: 'Public IP broadcast service'
      })
    ]
  });

  this.ip = ip;
};

util.inherits(IpCharacteristic, BlenoCharacteristic);

IpCharacteristic.prototype.onReadRequest = function(offset, callback) {
  console.log('on -> onReadRequest: value = ' + data.toString());  
  callback(this.RESULT_SUCCESS, ip.address());
};

module.exports = IpCharacteristic;
