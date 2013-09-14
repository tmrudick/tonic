var assert = require('assert'),
    Job = require('../lib/job');

var emptyFunc = function() {};

describe('Chaining Job API', function() {
    describe('Time based functions', function() {
        it('every translates into cron time', function(done) {
            var job = new Job('Test', {}, emptyFunc);

            // Seconds
            job.every('10s').every('10 seconds').every('10 sec');

            // Minutes
            job.every('5m').every('5 minutes').every('5 min');

            // Hours
            job.every('2h').every('2 hour').every('2 hr');

            // Days
            job.every('3d').every('3 days');

            // Seconds
            assert.equal(job.intervals[0], '*/10 * * * * *');
            assert.equal(job.intervals[1], '*/10 * * * * *');
            assert.equal(job.intervals[2], '*/10 * * * * *');

            assert.equal(job.intervals[3], '*/5 * * * *');
            assert.equal(job.intervals[4], '*/5 * * * *');
            assert.equal(job.intervals[5], '*/5 * * * *');

            assert.equal(job.intervals[6], '0 */2 * * *');
            assert.equal(job.intervals[7], '0 */2 * * *');
            assert.equal(job.intervals[8], '0 */2 * * *');

            assert.equal(job.intervals[9], '0 0 */3 * *');
            assert.equal(job.intervals[10], '0 0 */3 * *');

            assert.equal(job.intervals.length, 11);

            done();
        });

        it('at creates an interval', function(done) {
            var job = new Job('Test', {}, emptyFunc);

            job.at('10 * * * *');

            assert.equal(job.intervals[0], '10 * * * *');

            assert.equal(job.intervals.length, 1);

            done();
        });

        it('once creates a null interval', function(done) {
            var job = new Job('Test', {}, emptyFunc);

            job.once();

            assert.equal(job.intervals[0], null);

            assert.equal(job.intervals.length, 1);

            done();
        });
    });

    describe('Deferred property', function() {

    });

    describe('Job control states', function() {
        it('jobs can be started', function(done) {
            var job = new Job('Test', {}, function() {
                done();
            });

            job.once();
            job.start();
        });

        it('jobs can be stopped', function(done) {
            var counter = 0;
            var job = new Job('Test', {}, function(d) {
                counter += 1;
                d();
            });

            job.every('1s').start();
            assert.ok(job.intervals[0].running);
            job.stop();

            setTimeout(function() {
                assert.equal(counter, 1);
                assert.ok(!job.intervals[0].running);
                done();
            }, 10);

        });

        it('disabled jobs are not run', function(done) {
            var job = new Job('Test', {}, function() {
                assert.fail('Job code runs', 'Job code should not run');
            });

            job.once().disable();
            job.start();

            setTimeout(function() {
                done();
            }, 10);
        });

        it('re-enabled jobs still run', function(done) {
            var job = new Job('Test', {}, function() {
                done();
            });

            job.once().disable().enable();
            job.start();
        });
    });

    describe('Job initial startup', function() {
        it('deferred jobs are not run', function(done) {
            var job = new Job('Test', {}, function() {
                // If this code runs, the test fails.
                assert.fail('Job code runs', 'Job code should not run');
            });

            job.once().defer();

            job.start();

            // setTimeout so we wait for nextTick
            setTimeout(function() {
                done();
            }, 10);
        });

        it('will run time-based jobs immediately', function(done) {
            var job = new Job('Test', {}, function() {
                done();
            }).once();

            job.start();
        });

        it('will not run jobs that do not have time-based triggers', function(done) {
            var job = new Job('Test', {}, function() {
                assert.fail('Job code runs', 'Job code should not run.');
            });

            job.start();

            setTimeout(function() {
                done();
            }, 10);
        });
    });
});