var util = require('util'),
    EventEmitter = require('events').EventEmitter,
    CronJob = require('cron').CronJob,
    _ = require('lodash');

function Job(name, func) {
    this.name = name;
    this.func = func;

    // Keep track of job connections
    this.dependencies = [];

    // Keep track of job intervals
    this.intervals = [];

    // Job state
    this.enabled = true;
    this.started = false;

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

    // If we have more than 0 intervals, run now
    if (this.intervals.length > 0) {
        this.run();
    }
};

Job.prototype.stop = function() {
    if (this.started) {
        this.started = false;

        for (var idx = 0; i < this.intervals.length; i++) {
            this.intervals[idx].stop();
        }
    }
};

// Run the job a single time
Job.prototype.run = function() {
    var self = this;

    var done = function() {
        self.emit('done', self.name);
    };

    var context = {
        name: this.name
    };

    var args = [done].concat(Array.prototype.slice.call(arguments, 0));
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




/*
var CronJob = require('cron').CronJob,
    util = require('util'),
    winston = require('winston'),
    _ = require('lodash'),
    events = require('events'),
    util = require('util');

function Job(name, config, func) {
    // Input type checking
    if (name && typeof(name) !== 'string') {
        throw new Error('Job name must be a string');
    }

    if (typeof(func) !== 'function') {
        throw new Error('Job function must be a function');
    }

    this.data = null;
    this.name = name;
    this.config = config;
    this.func = func;

    // Just created so it is not started/running
    this.started = false;
    this.running = false;

    // Just created so it must be enabled
    this.enabled = true;

    // No dependencies yet
    this.dependencies = [];
    this.predecessors = [];

    // No intervals have been defined yet
    this.intervals = [];

    // Set up the event emitter
    events.EventEmitter.call(this);
};

util.inherits(Job, events.EventEmitter);

// Export Job
module.exports = exports = Job;

// == Job scheduling functions ==

// Run job once
Job.prototype.once = function() {
    this.intervals.push(null);

    return this;
};

// Run job on an interval
Job.prototype.every = function(interval) {
    this.intervals.push(_textToCron(interval));

    return this;
};

// Run job at a specific time every day
Job.prototype.at = function(time) {
    this.intervals.push(time);

    return this;
};

// Run job after another job runs
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

Job.prototype.before = function(jobs) {
    if (typeof(jobs) === 'string') {
        jobs = [jobs];
    } else if (!jobs instanceof Array) {
        throw new Error('Predecessors must be declared as a string or array of strings');
    }

    this.predecessors = _.uniq(this.predecessors.concat(jobs));

    return this;
}

// == Job result manipulation methods ==

// Only return a certain number of elements from the start of an array result
Job.prototype.take = function(count) {
    // Throw an error if take is already set
    if (this.take_count) {
        throw new Error('take count already defined for this job');
    }

    // Set take on the object
    this.take_count = count;

    return this;
};

// == Job state functions ==

Job.prototype.disable = function() {
    this.enabled = false;

    return this;
};

// Start the job (required before any job code runs)
Job.prototype.start = function() {
    // TODO: should this be here or somewhere else?

    var self = this;

    // If this isn't enabled, just return
    if (!this.enabled) { return; }

    // Mark this job as started
    this.started = true;

    // This is the done callback which will be
    // passed into the job function
    var callback = function(results) {
        self.running = false;

        if (self.data instanceof Array && results instanceof Array) {
            results = results.concat(self.data);
        }

        if (self.take_count && results instanceof Array) {
            results = _.take(results, self.take_count);
        }

        self.data = results;

        self.emit('done', self.name, self.data);
    };

    // Create helper closure to run the actual job code
    this.run = function() {
        // Don't allow jobs to overlap
        if (self.running) { return; }

        self.running = true;

        var context = {
            name: self.name,
            data: self.data,
            config: self.config
        };

        var args = [callback].concat(Array.prototype.slice.call(arguments, 0));
        self.func.apply(context, args);
    };

    // Setup job dependencies
    for (var idx in this.dependencies) {
        var dependency = this.dependencies[idx];

        if (dependency instanceof Array) {
            // TODO: Implement an array of dependencies
        } else {
            dependency.on('done', function(name, data) {
                self.run(name, data);
            });
        }
    }

    // Setup the schedulers
    for (var idx in this.intervals) {
        // Drop jobs that are configured to run once
        if (!this.intervals[idx]) {
            continue;
        }

        // Not sure if I like this reassigning...
        this.intervals[idx] = new CronJob(this.intervals[idx], this.run);
        this.intervals[idx].start();
    }
};*/

function _textToCron(text) {
    // If a user types 5min then we want the job to run every 5 minutes.
    // Same with hours or days. Acceptable values are:
    // 10m, 10minutes, 10 minutes, 1 day, once
    var units = {
        "m": '*/%d * * * *',
        "h": '0 */%d * * *',
        "d": '0 0 */%d * *',
        "s": '*/%d * * * * *'
    };

    // Return null if the user only wants to run something once
    if (text === "once") {
        return null;
    }

    Object.keys(units).forEach(function(key) {
        var idx = text.indexOf(key);

        if (idx > 0) {
            var value = text.substring(0, idx);
            text = util.format(units[key], value);
        }
    });

    return text;
}
