var util = require('util'),
    EventEmitter = require('events').EventEmitter,
    CronJob = require('cron').CronJob,
    _ = require('lodash');

function Job(name, config, func) {
    this.name = name;
    this.config = config;
    this.func = func;

    // Keep track of job connections
    this.dependencies = [];

    // Keep track of job intervals
    this.intervals = [];

    // Job state
    this.enabled = true;
    this.started = false;

    // If true, don't run the job when tonic starts
    this.deferred = false;

    // Call EventEmitter ctor
    EventEmitter.call(this);
}

// Subclass EventEmitter
util.inherits(Job, EventEmitter);

module.exports = Job;

// Methods for internal usages
Job.prototype.start = function() {
    // Job has started
    this.started = true;

    // For each interval we have, create a new cron job
    for (var idx = 0; idx < this.intervals.length; idx++) {
        var interval = this.intervals[idx];

        if (interval) {
            this.intervals[idx] = new CronJob(this.intervals[idx], this.run.bind(this));
            this.intervals[idx].start();
        }
    }

    // If we have more than 0 intervals and we aren't defered, run now
    if (this.intervals.length > 0 && !this.deferred && this.enabled) {
        this.run();
    }
};

Job.prototype.stop = function() {
    if (this.started) {
        this.started = false;

        this.intervals.forEach(function(interval) {
            if (interval != null) {
                interval.stop();
            }
        });
    }
};

// Run the job a single time
Job.prototype.run = function() {
    var self = this;

    var done = function(data) {
        // Save the first argument to the cache
        this.data = data;

        // Pass everything else to the next job
        var args = Array.prototype.slice.call(arguments, 0);
        args = ['done', self.name].concat(args);
        self.emit.apply(self, args);
    };

    var args = Array.prototype.slice.call(arguments, 0);

    var context = {
        name: this.name,
        parent: args.shift(), // Get the first name (or undefined as the parent)
        config: this.config,
        data: this.data
    };

    args = [done].concat(args);
    process.nextTick(function() { self.func.apply(context, args); });
};

// Methods for configuration
Job.prototype.once = function() {
    // null interval means run at start
    this.intervals.push(null);

    return this;
};

Job.prototype.every = function(interval) {
    this.intervals.push(_textToCron(interval));

    return this;
};

Job.prototype.at = function(time) {
    this.intervals.push(time);

    return this;
};

Job.prototype.after = function(jobs) {
    if (typeof(jobs) === 'string') {
        // If we have a single string, make it an array
        jobs = [jobs];
    } else if (!jobs instanceof Array) {
        // If we *don't* have an array, throw an exception
        throw new Error('Dependencies must be declared as a string or array of strings');

        // TODO: Check that this array actually contains strings
    }

    // Add these dependencies to our list and make sure the list is a set
    this.dependencies = _.uniq(this.dependencies.concat(jobs));

    return this;
};

Job.prototype.disable = function() {
    this.enabled = false;

    return this;
};

Job.prototype.enable = function() {
    this.enabled = true;

    return this;
};

Job.prototype.defer = function() {
    this.deferred = true;

    return this;
}

function _textToCron(text) {
    var regex = /^(\d+)\s{0,1}(\w)\w*$/;

    // If a user types 5min then we want the job to run every 5 minutes.
    // Same with hours or days. Acceptable values are:
    // 10m, 10minutes, 10 minutes, 1 day, once
    var units = {
        'm': '*/%d * * * *',
        'h': '0 */%d * * *',
        'd': '0 0 */%d * *',
        's': '*/%d * * * * *'
    };

    if (regex.test(text)) {
        var matches = regex.exec(text),
            value = matches[1],
            key = matches[2];

        text = util.format(units[key], value);
    }

    return text;
}
