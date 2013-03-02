var fs = require('fs'),
	jade = require('jade'),
	path = require('path'),
	Job = require('./job');

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
	var fullPath = path.resolve(template);

	this.compiledTemplate = jade.compile(templateSource, { filename: fullPath });

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
	global.job = function(id, interval, func) {
		if (self._jobs[id]) {
			throw new Error("Job with id '" + id + "' already exists.");
		}

		// Create a new job and return it so that we can do method chaining
		self._jobs[id] = new Job(id, interval, func);
		return self._jobs[id];
	};	

	files.forEach(function(file) {
		// Don't do anything for non-js files
		if (path.extname(file) !== '.js') {
			return;
		}

		require(process.cwd() + '/' + dir + '/' + file);
	})

	// Tear down the global
	delete global.job;
};

Bourbon.prototype.start = function() {
	var self = this,
	    jobs = Object.keys(this._jobs);

	// Set Bourbon into a running mode
	this.running = true;

	var callback = function() {
		if (!this.updateInterval || this._queuedWrite) {
			self.write();
		}	
	};

	// For each job, start it
	jobs.forEach(function(id) {
		self._jobs[id].start(callback);
	});
};

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
		if (!self._jobs[id].enabled) {
			return true;
		}

		data[id] = self._jobs[id]._data;

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