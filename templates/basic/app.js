var Tonic = require('tonic');

var tonic = new Tonic();
tonic.jobs('job.js');

tonic.start();