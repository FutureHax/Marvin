var hue = require("node-hue-api"),
    HueApi = hue.HueApi,
    lightState = hue.lightState;

var displayResults = function(result) {
    console.log(JSON.stringify(result, null, 2));
};

var host = "192.168.1.136",
    username = "2b181bc2237201b78ecc0deed881c3",
    api = new HueApi(host, username);

var onState = lightState.create().turnOn();
var offState = lightState.create().turnOff();

for (var i=2;i<8;i++) {
 setLightState(i, onState);
}

function setLightState(id, state) {
  api.setLightState(id, state)
    .then(displayResult)
    .done();
}

var displayResult = function(result) {
    console.log(JSON.stringify(result, null, 2));
};
