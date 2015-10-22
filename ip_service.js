var util = require('util');

var bleno = require('bleno');
var BlenoPrimaryService = bleno.PrimaryService;

var IpCharacteristic = require('./characteristic');

function IpService(ip) {
  IpService.super_.call(this, {
    uuid: '01010101010101010101010101010101',
    characteristics: [
      new IpCharacteristic(ip)
    ],
    descriptors: [
      new BlenoDescriptor({
        uuid: '2900',
        value: 'Public IP broadcast service'
      })
    ]
  });
}

util.inherits(IpService, BlenoPrimaryService);

module.exports = IpService;
