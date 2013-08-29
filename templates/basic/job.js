// Print the time to the console ever 10 seconds
job('print time', function(done) {
    console.log(new Date());

    done();
}).every('10s');