
var assert = require('assert'),
    Tonic = require('../lib/tonic'),
    Job = require('../lib/job'),
    path = require('path');

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
    it('will load a single job file');
    it('will load a directory of job files');
    it('will load modules from node_module directory');
});

describe('Job creation', function() {
    it('should create jobs without a name');
    it('should verify that job names are unique');
});

describe('Run state', function() {
    it('should be able to start running');
    it('should be able to stop running');
});

describe('Job dependency graph creation', function() {

});