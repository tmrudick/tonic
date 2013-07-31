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

    if (this._config.cache) {
        try {
            this._cache = require(path.join(process.cwd(), this._config.cache));
        } catch (e) {
            this._cache = {};
        }
    } else {
        this._cache = {};
    }

    this._modules = options.modules;

    this.running = false;

    var internal_jobs = path.join(__dirname, 'jobs');
    this.module(internal_jobs);
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

        self._jobs[id] = new Job(name, self._cache[id] || {}, self._config, func);

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
};

// Borrowed from stackoverflow for the time being
function makeid()
{
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for( var i=0; i < 5; i++ )
        text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
}