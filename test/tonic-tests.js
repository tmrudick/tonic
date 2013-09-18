
var assert = require('assert'),
    Tonic = require('../lib/tonic'),
    Job = require('../lib/job'),
    path = require('path');

var emptyFunc = function(d) { d(); };

describe('Configuration', function() {
    it('will assume default file paths if config is not given', function(done) {
        var options = {};

        var tonic = new Tonic(options); // no options

        // Options defaults are working
        assert.equal(options.config, 'config.json');
        assert.equal(options.cache, 'data_cache.json');

        // Config is an object (empty)
        assert.equal(typeof(tonic._config), 'object');
        assert.equal(Object.keys(tonic._config).length, 0);

        // Cache object exists and is empty
        assert.ok(tonic._cache.filename);
        assert.equal(typeof(tonic._cache.data), 'object');
        assert.equal(Object.keys(tonic._cache.data).length, 0);

        done();
    });

    it('should override the defaults with provided options', function(done) {
        // TODO: Override require for json loading instead of this
        var options = {
            config: 'test/fixtures/test-config.json',
            cache: 'test/fixtures/test-data-cache.json'
        };

        var tonic = new Tonic(options);
        assert.equal(tonic._config.option, 'value');
        assert.equal(tonic._cache.data.job, 'Some previous value');

        done();
    });

    it('will create an empty config if config file does not exist', function(done) {
        var options = {
            config: 'some-file-that-doesnt-exist.json'
        };

        var tonic = new Tonic(options);
        assert.equal(typeof(tonic._config), 'object');
        assert.equal(Object.keys(tonic._config).length, 0);

        done();
    });
});

describe('Loading Jobs', function() {
    it('will load a single job file', function(done) {
        var tonic = new Tonic();
        tonic.jobs('test/fixtures/single-job.js');
        tonic.start();

        setTimeout(function() {
            assert.ok(global.singleJob);
            done();
        }, 25);
    });

    it('will load a directory of job files', function(done) {
        var tonic = new Tonic();
        tonic.jobs('test/fixtures/jobs');
        tonic.start();

        setTimeout(function() {
            assert.ok(global.jobone);
            assert.ok(global.jobtwo);
            done();
        }, 25);
    });

    it('will load modules from node_module directory');

    it('will load an already constructed job object', function(done) {
        var tonic = new Tonic();
        var job = new Job('Name', {}, function() {
            global.constructedJob = true;
        }).once();

        tonic.jobs(job);
        tonic.start();

        setTimeout(function() {
            assert.ok(global.constructedJob);
            done();
        }, 25);
    });
});

describe('Job creation', function() {
    it('should create jobs without a name', function(done) {
        var tonic = new Tonic();
        tonic.jobs('test/fixtures/job-without-id.js');

        var jobIds = Object.keys(tonic._jobs);

        // Only one job
        assert.equal(jobIds.length, 1);

        // 5 character 'id'
        assert.equal(jobIds[0].length, 5);

        // No name
        assert.equal(tonic._jobs[jobIds[0]].name, null);

        // Still runs!
        tonic.start();

        setTimeout(function() {
            assert.ok(global.jobWithNoName);
            done();
        }, 25);
    });

    it('will not load two jobs with the same id', function(done) {
        var tonic = new Tonic();

        assert.throws(function() {
            tonic.jobs('test/fixtures/duplicate-jobs.js');
        }, /Job 'BadJob' already defined/);

        done();
    });
});

describe('Run state', function() {
    it('should be able to start and stop running', function(done) {
        var tonic = new Tonic();

        global.runStateCount = 0;
        var job = new Job(null, {}, function() {
            if (global.runStateCount == 1) {
                assert.fail('Should not be here');
            }
            global.runStateCount++;
        }).once().every('1s');

        tonic.jobs(job);

        assert.ok(!tonic.running);
        tonic.start();
        assert.ok(tonic.running);
        tonic.stop();
        assert.ok(!tonic.running);

        setTimeout(function() {
            assert.equal(global.runStateCount, 1);
            done();
        }, 1000);
    });
});

describe('Job dependency graph creation', function() {
    it('should not allow taking a dependency on an undefined job', function(done) {
        var jobA = new Job('A', {}, emptyFunc).after('DoesNotExist');

        var tonic = new Tonic();
        tonic.jobs(jobA);
        assert.throws(function() { tonic.start(); }, /Job 'DoesNotExist' does not exist/);
        done();
    });

    it('should allow jobs to take direct dependencies on other jobs', function(done) {
        var jobA = new Job('A', {}, emptyFunc);
        var jobB = new Job('B', {}, emptyFunc).after('A');

        var tonic = new Tonic();
        tonic.jobs(jobA);
        tonic.jobs(jobB);

        tonic.start();

        assert.equal(jobB.dependencies[0], jobA.name);
        done();
    });

    it('should allow a job to take a dependency on all other jobs using *', function(done) {
        var jobA = new Job('A', {}, emptyFunc);
        var jobB = new Job('B', {}, emptyFunc);
        var jobC = new Job('C', {}, emptyFunc).after('*');

        var tonic = new Tonic();
        tonic.jobs(jobA);
        tonic.jobs(jobB);
        tonic.jobs(jobC);

        assert.equal(jobC.dependencies.length, 1);
        assert.equal(jobC.dependencies[0], '*');

        tonic.start();

        assert.equal(jobC.dependencies.length, 3);
        assert.equal(jobC.dependencies[0], '*');
        assert.equal(jobC.dependencies[1], jobA.name);
        assert.equal(jobC.dependencies[2], jobB.name);

        done();
    });

    it('should disallow * jobs from taking a dependency on each other', function(done) {
        var jobA = new Job('A', {}, emptyFunc).after('*');
        var jobB = new Job('B', {}, emptyFunc).after('*');

        var tonic = new Tonic();
        tonic.jobs(jobA).jobs(jobB);

        // Before we start tonic
        assert.equal(jobA.dependencies.length, 1);
        assert.equal(jobB.dependencies.length, 1);
        assert.equal(jobA.dependencies[0], '*');
        assert.equal(jobB.dependencies[0], '*');

        tonic.start();

        // Only one tonic listener which writes data to disk
        assert.equal(jobA.listeners('done').length, 1);
        assert.equal(jobB.listeners('done').length, 1);

        done();
    });

    it('should allow jobs to take a dependeny on more than one other job', function(done) {
        var jobA = new Job('A', {}, emptyFunc);
        var jobB = new Job('B', {}, emptyFunc);
        var jobC = new Job('C', {}, emptyFunc).after('A').after('B');

        var tonic = new Tonic();
        tonic.jobs(jobA).jobs(jobB).jobs(jobC);
        tonic.start();

        assert.equal(jobC.dependencies.length, 2);
        assert.equal(jobC.dependencies[0], jobA.name);
        assert.equal(jobC.dependencies[1], jobB.name);

        done();
    });

    it('should start dependent jobs when the parent job finishes', function(done) {
        var jobA = new Job('A', {}, emptyFunc).once();;
        var jobB = new Job('B', {}, function() {
            assert.equal(this.parent, jobA.name);
            done();
        }).after('A');

        var tonic = new Tonic();
        tonic.jobs(jobA).jobs(jobB);
        tonic.start();
    });
});