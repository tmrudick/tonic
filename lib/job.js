var CronJob = require('cron').CronJob,
    util = require('util'),
    winston = require('winston');

function Job(id, data, interval, func) {
    this.id = id;
    this.interval = interval;
    this.func = func;
    this.started = false;
    this.enabled = true;

    this._data = data;
}

module.exports = exports = Job;

// Sets the retention policy for jobs that return an array of data
Job.prototype.expiration = function(count) {
    this.expiration_count = count;

    return this;
};

Job.prototype.start = function(executed, timezone) {
    var self = this;

    winston.log('info', 'Starting job %s.', this.id);

    // Schedule the job to execute
    this.started = true;

    var _callback = function(results) {
        winston.log('info', 'Job %s completed.', self.id);

        // Mark the job as no longer running
        self.running = false;

        // Process the returned value
        if (results instanceof Array) { // Case where we are returning an array, probably time-series data
            // If we don't have data, or the existing data isn't an array, or the expiration count is 0, completely replace the old data
            if (!self._data || !(self._data instanceof Array) || self.expiration_count === 0) {
                self._data = results;
            }  else {
                // If the above is not met, concat the two arrays together (new data comes after)
                self._data = self._data.concat(results);
            }

            // If we have a expiration policy, enforce it on the data.
            // By this point, an expiration policy of 0 has already been dealt with
            if (self.expiration_count > 0) {
                var slice_count = self._data.length - self.expiration_count;
                if (slice_count < 0) { slice_count = 0; }

                self._data = self._data.slice(slice_count);
            }
        } else if (results) {
            // If we have results but it isn't an array, just replace what we already have.
            self._data = results;
        }

        // Let the runtime know that this job has completed
        executed();
    };

    // Run the current job
    var _runJob = function() {
        if (self.running || !self.enabled) {
            return; // Don't allow jobs to overlap
        }

        self.running = true;
        self.func.call(null, _callback, self._data);
    }

    // Run the job once right away
    _runJob();

    // Setup the schedule for the job
    // Use setTimeout if short time is specified
    var cron = _textToCron(this.interval);
    if (cron) {
        this.schedule = new CronJob(cron, _runJob, null, true, timezone);
        this.schedule.start();
    }
};

Job.prototype.stop = function() {
    winston.log('info', 'Stopping job %s.', this.id);
    this.running = false;
    this.schedule && this.schedule.cancel();
};

// Allows us to do job(...).disable();
Job.prototype.disable = function() {
    winston.log('verbose', 'Job %s is disabled.', this.id);
    this.enabled = false;
    return this;
};

// Probably won't be used
Job.prototype.enable = function() {
    this.enabled = true;
    return this;
};

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
