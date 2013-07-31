var fs = require('fs'),
    path = require('path');

var cache = {};

// Job to write everything that comes from every other job to disk
job(function(done, previous, data) {

    if (!this.config.cache || !previous) {
        return done();
    }

    cache[previous] = data;

    fs.writeFileSync(path.join(process.cwd(), this.config.cache), JSON.stringify(cache), 'utf-8');

    done();
}).after('*');