var path = require('path'),
    fs = require('fs'),
    Job = require('./job'),
    _ = require('lodash');

/**
 * Main Tonic Object
 */

function Tonic() {
    // Not running yet
    this.running = false;

    // Store jobs in here: name -> Job
    this._jobs = {};
}

Tonic.prototype.jobs = function(directoryOrFile) {
    var self = this,
        files = [];

    // If path ends in .js, we will only load a single file
    if (path.extname(directoryOrFile) === '.js') {
        files.push(directoryOrFile);
    } else {
        // Otherwise, we will load a whole directory of files
        // (but only .js files.)
        fs.readdirSync(directoryOrFile).forEach(function(file) {
            if (path.extname(file) === '.js') {
                files.push(file);
            }
        });
    }

    // Create global job creation function
    global.job  = function(nameOrFunc, func) {
        // Figure out if we have a job name or not
        if (typeof(nameOrFunc) !== 'string') {
            func = nameOrFunc;
            nameOrFunc = null;
        }

        var id = makeId(nameOrFunc);

        if (self._jobs[id]) {
            throw new Error("Job '" + id + "' already defined.");
        }

        self._jobs[id] = new Job(nameOrFunc, func);

        return self._jobs[id];
    };

    var directory = path.resolve(directoryOrFile);

    // Require each file so they execute the above job function
    files.forEach(function(file) {
        require(path.join(directory, file));
    });

    // Tear down the global
    delete global.job;

    // Return the Tonic object for chaining
    return this;
};

Tonic.prototype.start = function() {
    var self = this;

    // First, we populate the dependency graph
    var ids = Object.keys(this._jobs);

    // Loop over each job
    ids.forEach(function(id) {
        var job = self._jobs[id],
            wildcard = false;

        // Fill out the dependency array

        // If we have a wild card dependency, add everything
        if (_.contains(job.dependencies, '*')) {
            job.dependencies = _.uniq(job.dependencies.concat(ids));
            wildcard = true;
        }

        // Loop over each dependency and hook up the event listener
        job.dependencies.forEach(function(depdendentId) {
            // If this is the wildcard, skip it
            if (depdendentId === '*') {
                return;
            }

            // Get the job and check that it actually exists
            var dependency = self._jobs[depdendentId];

            if (!dependency) {
                throw new Error("Job '" + depdendentId + "' does not exist.");
            }

            // As long as one of these isn't a wildcard, add the event
            if (!_.contains(job.dependencies, '*') || !_.contains(dependency.dependencies, '*')) {
                dependency.on('done', job.run.bind(job));
            }
        });
    });

    this.running = true;

    // Loop over the jobs again and start each one
    ids.forEach(function(id) {
        self._jobs[id].start();
    });
};

Tonic.prototype.stop = function() {
    if (this.running) {
        var self = this,
            ids = Object.keys(this._jobs);

        ids.forEach(function(id) {
            self._jobs[id].stop();
        });
    }
};

module.exports = Tonic;

/*
var fs = require('fs'),
    Handlebars = require('handlebars'),
    path = require('path'),
    Job = require('./job'),
    winston = require('winston'),
    _ = require('lodash');





function Tonic(options) {
    this._jobs = {};

    if (options.config) {
        this._config = require(path.join(process.cwd(), options.config));
    } else {
        this._config = {};
    }

    this._modules = options.modules;

    this.running = false;
}

module.exports = exports = Tonic;

Tonic.prototype.module = function(name) {
    if (name.indexOf('/') !== 0) {
        name = path.join('node_modules', name);
    }

    return this.jobs(name);
};

Tonic.prototype.jobs = function(dir) {
    var self = this,
        files = fs.readdirSync(dir);

    // Just make sure that we have an absolute path
    dir = path.resolve(dir);

    // Set up the global function for this job to use
    global.job = function(nameOrFunc, func) {
        var name = null;

        if (typeof(nameOrFunc) === 'string') {
            name = nameOrFunc;
        } else {
            func = nameOrFunc;
        }

        if (name && self._jobs[name]) {
            throw new Error("Job with name '" + name + "' already exists.");
        }

        var id = name;

        if (!id) {
            id = makeid();
        }

        return self._jobs[id];
    };

    files.forEach(function(file) {
        // Don't do anything for non-js files
        if (path.extname(file) !== '.js') {
            return;
        }

        require(path.join(dir, file));
    });

    // Tear down the global
    delete global.job;

    return this;
};

Tonic.prototype.start = function() {
    var self = this,
        jobs = Object.keys(this._jobs);

    // Set Tonic into a running mode
    this.running = true;

    var after_all = [null];

    jobs.forEach(function(name) {
        var job = self._jobs[name];

        if (_.contains(job.dependencies, '*')) {
            after_all.push(job);
            job.dependencies = _.uniq(Object.keys(self._jobs).concat(job.dependencies));
        }

        if (_.contains(job.predecessors, '*')) {
            job.predecessors = _.uniq(Object.keys(self._jobs).concat(job.predecessors));
        }

        job.predecessors = _.without(job.predecessors, name, '*');
        job.dependencies = _.without(job.dependencies, name, '*');

        for (var idx in job.dependencies) {
            var dep = job.dependencies[idx];
            if (typeof(dep) === 'string') {
                job.dependencies[idx] = self._jobs[dep];
            }
        }

        // Add predecessors
        for (var idx in job.predecessors) {
            var pre = job.predecessors[idx];
            self._jobs[pre].dependencies.push(self._jobs[name]);

            // Remove all 'once' runs
            self._jobs[pre].intervals = _.compact(self._jobs[pre].intervals);
        }
    });

    jobs.forEach(function(name) {
        after_all[0] = self._jobs[name].dependencies;
        self._jobs[name].dependencies = _.without.apply(null, after_all);
    });

    jobs.forEach(function(name) {
        self._jobs[name].start();

        if (self._jobs[name].intervals.length > 0 && self._jobs[name].run) {
            self._jobs[name].run();
        }
    });
};*/

// Borrowed from stackoverflow for the time being
function makeId(name)
{
    if (name) {
        return name;
    }

    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for( var i=0; i < 5; i++ )
        text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
}