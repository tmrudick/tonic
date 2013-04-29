var fs = require('fs'),
    handlebars = require('handlebars'),
    path = require('path'),
    Job = require('./job');

function Bourbon(templates, options) {
    // templates = [{ template: ..., filename: ...}]
    // options:
    //    - updateInterval - seconds to wait before writing
    //	  - cache = the cache data file to use to save data
    //    - helpers - additional handlebars helpers [{name: '', helper: func }]
    var self = this;

    // If there is no update interval, that is ok. We will just
    // update the outputFile whenever a job completes. This may
    // cause more writes to disk than is desired but it will
    // keep the outputFile current.
    this.updateInterval = options && options.updateInterval;

    // Add handlebars helper functions
    handlebars.registerHelper('link', function(text, url) {
        return new Handlebars.SafeString(
            "<a href='" + url + "'>" + text + "</a>"
        );
    });

    handlebars.registerHelper('json', function(object) {
        return JSON.stringify(object);
    });

    // TODO: Register optional helpers

    // Compile all of the templates
    this.templates = [];
    templates.forEach(function(template) {
        var source = fs.readFileSync(path.join('templates', template.template), 'utf-8');
        self.templates.push({
            filename: path.join('public', template.filename),
            compiled: handlebars.compile(source)
        })
    });

    this._jobs = {};
    this._queuedWrite = false;

    this._jsonPath = options.json;

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

    // Just make sure that we have an absolute path
    dir = path.resolve(dir);

    var existingData = {};
    if (this._jsonPath) {
        existingData = fs.readFileSync(this._jsonPath);
        existingData = JSON.parse(existingData);
    }

    // Set up the global function for this job to use
    global.job = function(id, interval, func) {
        if (self._jobs[id]) {
            throw new Error("Job with id '" + id + "' already exists.");
        }

        // Create a new job and return it so that we can do method chaining
        self._jobs[id] = new Job(id, existingData[id], interval, func);
        return self._jobs[id];
    };

    files.forEach(function(file) {
        // Don't do anything for non-js files
        if (path.extname(file) !== '.js') {
            return;
        }

        require(path.join(dir, file));
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

        if (self._jobs[id].running) {
            self._queuedWrite = true;
            return false;
        }

        return true;
    });

    // If we have data for everything, write the file
    if (write) {
        self._queuedWrite = false;

        // If we are saving json data, write our state to disk
        if (this._jsonPath) {
            fs.writeFileSync(this._jsonPath, JSON.stringify(data), 'utf-8');
        }

        this.templates.forEach(function(template) {
            var html = template.compiled(data);
            fs.writeFileSync(template.filename, html, 'utf-8');
        });
    }
};