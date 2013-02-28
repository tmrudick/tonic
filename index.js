var fs = require('fs'),
	jade = require('jade'),
	path = require('path'),
	schedule = require('node-schedule');

function Bourbon(template, outputFile, options) {
	// options:
	//    - template
	//    - output
	//    - updateInterval

	this.template = template;
	this.outputFile = outputFile;

	// If there is no update interval, that is ok. We will just
	// update the outputFile whenever a job completes. This may
	// cause more writes to disk than is desired but it will
	// keep the outputFile current.
	this.updateInterval = options && options.updateInterval;

	// Validate that we have our required properties
	// TODO: Do this better
	_validateRequiredProperties(this, ['template', 'outputFile']);

	var templateSource = fs.readFileSync(template);
	this.compiledTemplate = jade.compile(templateSource);

	this._jobs = {};
	this._queuedWrite = false;

	this.running = false;
}

module.exports = exports = Bourbon;

function _validateRequiredProperties(bourbon, properties) {
	properties.forEach(function(property) {
		if (!bourbon[property]) {
			throw new Error("The '" + property + "' parameter is required");
		}
	});
}

Bourbon.prototype.jobs = function(dir) {
	var self = this,
		files = fs.readdirSync(dir);

	// Set up the global function for this job to use
	global.job = function(id, description, interval, func) {
		if (self._jobs[id]) {
			throw new Error("Job with id '" + id + "' already exists.");
		}

		self._jobs[id] = {
			id: id,
			description: description,
			interval: interval,
			func: func,
			started: false
		};
	};	

	global.job.skip = function(id) {
		self._jobs[id] = {
			data: {},
			interval: '* * * * *'
		}
	};

	files.forEach(function(file) {
		// Don't do anything for non-js files
		if (path.extname(file) !== '.js') {
			return;
		}

		require(process.cwd() + '/' + dir + '/' + file);
	})

	if (this.running) { 
		this.start(); 
	}
};

Bourbon.prototype.start = function() {
	var self = this,
	    jobs = Object.keys(this._jobs);

	this.running = true;

	jobs.forEach(function(id) {
		var job = self._jobs[id];

		if (!job.started) {
			var callback = _curry(self, _completedJobCallback, job.id);

			// Run the job once
			_runJob(job, callback);

			// Schedule the job based on the interval
			// TODO: How to schedule?
			job.started = true;
			job.scheduled = schedule.scheduleJob(job.interval, _curry(null, _runJob, job, callback));
		}
	});
};

function _runJob(job, callback) {
	// Don't kick off the job again if it is still running
	if (job.running) {
		return;
	}

	job.running = true;
	if (job.func) { 
		job.func.call(null, callback);
	}
}

Bourbon.prototype.stop = function() {
	// TODO: Stop all scheduled jobs and don't run new jobs
};

Bourbon.prototype.write = function() {
	var self = this;
	// Build object to pass to jade
	var jobIds = Object.keys(this._jobs);

	var data = {};

	// Loop over every job and build a data object to
	// pass into jade. If we don't have data for every
	// job yet, wait until we do so we don't have weird
	// values everywhere.
	var write = jobIds.every(function(id) {
		data[id] = self._jobs[id].data;

		if (!data[id]) {
			self._queuedWrite = true;
			return false;
		}

		return true;
	});

	// If we have data for everything, write the file
	if (write) {
		self._queuedWrite = false;
		var html = this.compiledTemplate(data);
		fs.writeFileSync(this.outputFile, html, 'utf-8');
	}
};

function _completedJobCallback(jobId, data) {
	// NOTE: this === Bourbon for curried calls
	// TODO: is that the right thing to do here?

	// TODO: Complete this method to get in the data and 
	// optionally run jade over the template file
	this._jobs[jobId].data = data;
	this._jobs[jobId].running = false;

	// If there isn't any update interval, then write
	// out as soon as we have enough data for every
	// running job.
	if (!this.updateInterval || this._queuedWrite) {
		this.write();
	}
}

function _curry(self, func) {
	var args = Array.prototype.slice.call(arguments, 2);
	return function() {
		func.apply(self, args.concat(Array.prototype.slice.call(arguments)));
	};
}