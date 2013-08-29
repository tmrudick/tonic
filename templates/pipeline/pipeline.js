// Print the time to the console ever 10 seconds
job('print time', function(done) {
    var now = new Date();
    console.log(now);

    done(now);
}).every('10s');

job(function(done, time) {
    console.log('The year is ', time.getFullYear());
}).after('print time');