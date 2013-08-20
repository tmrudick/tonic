var path = require('path'),
    fs = require('fs'),
    Job = require('./job'),
    _ = require('lodash');

/**
 * Main Tonic Object
 */

function Tonic(options) {
    // Not running yet
    this.running = false;

    // Store jobs in here: name -> Job
    this._jobs = {};

    options = options || {};

    options.config = options.config || 'config.json';
    options.cache = options.cache || 'data_cache.json';

    try {
        this._config = require(path.join(process.cwd(), options.config));
    } catch (e) {
        this._config = {};
    }

    try {
        var configPath = path.join(process.cwd(), options.cache);
        this._cache = { filename: configPath };
        if (fs.existsSync(configPath)) {
            this._cache.data = require(configPath);
        } else {
            this._cache.data = {}
        }
    } catch (e) {
        this._cache = null;
    }
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

        self._jobs[id] = new Job(nameOrFunc, self._config, func);
        self._jobs[id].data = self._cache && self._cache.data[id];

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

Tonic.prototype.module = function(name) {
    if (name.indexOf('/') !== 0) {
        name = path.join('node_modules', name);
    }

    return this.jobs(name);
};

Tonic.prototype.start = function() {
    var self = this;

    // First, we populate the dependency graph
    var ids = Object.keys(this._jobs);

    // Loop over each job
    ids.forEach(function(id) {
        var job = self._jobs[id],
            wildcard = false;

        // If we have a valid cache, attach and writer event handler
        // to continuously write cached data to the filesystem
        if (self._cache && job.name) {
            job.on('done', function(name, data) {
                self._cache.data[id] = data;
                fs.writeFileSync(self._cache.filename, JSON.stringify(self._cache.data), 'utf-8');
            });
        }

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