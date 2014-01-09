tonic.js
=======

[![Build Status](https://travis-ci.org/tmrudick/tonic.png?branch=master)](https://travis-ci.org/tmrudick/tonic)

tonic helps to build scheduled or event based job pipelines using JavaScript. It can be used to build a system of triggers similar to IFTTT but with more complex logic utilizing any data source and boolean operations.

Imagine you wanted to text youself whenever your favorite football team scored a touchdown. You could write a series of functions which: poll a sports API every 30 seconds and if there is a change in the score reformat the response from the API and then send a text message to your phone number. tonic allows you to write such a complex system of functions in a modular and reusable way.

Example Uses
------------

### Data driven websites

[tomrudick.com](http://tomrudick.com), [api.tomrudick.com](http://api.tomrudick.com), and [ellenchisa.com](http://ellenchisa.com) all use tonic to display near-real-time data that is automatically updated.

You can get examples of specific jobs [here](https://github.com/tmrudick/tomrudick.com/tree/master/jobs) or [here](https://github.com/ellenchisa/website/tree/master/jobs).

### Home automation

The [hue-weather-lights](https://github.com/tmrudick/hue-weather-lights) project uses tonic to change the colors of Philips Hue lightbulbs based on local weather conditions.

Have another use?

Getting Started
---------------

Before you get started, you must already have [node.js](http://nodejs.org) installed.

### Installing

    $ npm install -g tonic

### Creating an Empty Project

    $ tonic new TonicProject
    $ cd TonicProject ; npm install

This will create and setup empty project ready for you to start creating jobs.

### Writing a Job

Create a new file in the jobs directory with a .js extension.

    job('EveryMinute', function() {
      console.log('Running...');
    }).every('1min');

This will create a new job that executes once every minute.

### Running

    $ node app.js

This will run all registered jobs. You should see `Running...` printed out to the console once every minute.

### Chaining Jobs

Create another file in the jobs directory with a .js extension.

    job('RandomGenerator', function(done) {
      var rnd = Math.random();

      done(rnd);
    }).every('10 seconds');

    job('RandomPrinter', function(done, rnd) {
      console.log('Random:', rnd);
    }).after('RandomGenerator');

You can rerun `app.js` and you should now see a random number printed to the console every 10 seconds.

In this example, RandomGenerator will run every second and RandomPrinter will be run after RandomGenerator completes. The done callback is used to denote that a job has completely successfully. If there are no dependent jobs, calling done is optional.

Documentation
-------------

Check out the entire [documentation](http://tonicjs.org/docs) for more information.
