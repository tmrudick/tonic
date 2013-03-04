// This job will randomly output a new quote every minute
job('bad_joke', '1min', function(done) {
	// Define a few bad jokes in an array
	var jokes = [
		"Did you hear about the angry pancake? He just flipped.",
		"What did one ocean say to the other ocean? Nothing, they just waved.",
		"I tried to catch some fog earlier. I mist.",
		"I went to a seafood disco last night. I pulled a mussel.",
		"There's a new type of broom out, it's sweeping the nation."
	];

	// Generate a random numbr and pick a joke
	var rnd = Math.floor(Math.random() * (jokes.length + 1));
	var joke = jokes[rnd];

	// Return the joke and indicate job completion
	done(joke);
});