var Tonic = require('tonic');

var tonic = new Tonic();
tonic.jobs('pipeline.js');

tonic.start();