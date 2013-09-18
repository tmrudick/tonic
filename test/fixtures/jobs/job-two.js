job('Job Two', function(done) {
    global.jobtwo = true;

    done();
}).once();