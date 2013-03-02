var schedule = require('node-schedule');

function Job(id, interval, func) {
	this.id = id;
	this.interval = interval;
	this.func = func;
	this.started = false;
	this.enabled = true;

	this._data = null;
}

module.exports = exports = Job;

// Sets the retention policy for jobs that return an array of data
Job.prototype.expiration = function(count) {
	this.expiration = count;

	return this;
};

Job.prototype.start = function(executed) {
	var self = this;

	// Schedule the job to execute
	this.started = true;

	// Setup the schedule for the job
	this.schedule = schedule.scheduleJob(this.interval, _runJob);

	var _callback = function(results) {
		// Mark the job as no longer running
		self.running = false;

		// Process the returned value
		if (results instanceof Array) { // Case where we are returning an array, probably time-series data
			if (!self._data instanceof Array || self.expiration === 0) {
				self._data = results; // If self._data isn't an array, replace it
			}  else {
				self._data.push(results);
			}

			if (self.expiration > 0) { // If we have a expiration policy, enforce it on the data
				self._data = self._data.slice(self.retention);
			}
		} else if (results) {
			// If we have results but it isn't an array, just
			// replace what we already have.
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
		self.func.call(null, _callback);
	}

	// Run the job once right away
	_runJob();
};

Job.prototype.stop = function() {
	this.running = false;
	this.schedule.cancel();
};

// Allows us to do job(...).disable();
Job.prototype.disable = function() {
	this.enabled = false;

	return this;
};

// Probably won't be used
Job.prototype.enable = function() {
	this.enabled = true;

	return this;
};