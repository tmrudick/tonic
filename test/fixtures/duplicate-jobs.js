job('BadJob', function(done) {
    global.singleJob = true;
    done();
});

job('BadJob', function(done) {
    global.singleJob = true;
    done();
});