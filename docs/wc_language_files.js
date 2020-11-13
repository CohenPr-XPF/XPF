/* WC File Parser and Word List Calcs*/


// Create html request in order to read word list files for each language
function get(url) {

  return new Promise(function(resolve, reject) {

    var req = new XMLHttpRequest();
    req.open("GET", url);

    req.onload = function() {
      if(req.status == 200) {
        resolve(req.response);
      }
      else {
        reject(Error(req.statusText));
      }
    };

    req.onerror = function() {
      reject(Error("Network Error"));
    };

    req.send();
  });
}


async function read_wordlists(filename) {

  if (!filename) {   // ensure file exists
    alert("Error: No file is listed for the language");
    return;
  }


  var rawdata = await get(filename);
  var lines = rawdata.split("\n");
  var word_list = [];
  var lines2 = [];

  // Exclude word/frequency entries where capital letters are present
  for (line in lines) {
    if (lines[line].match(/.*\p{Lu}.*/gu) == null) {
      lines2.push(lines[line]);
    }
  }

  lines = lines2; // override initial lines variable with desired input

  // Create a table/dictionary that lists the word followed by its frequency (preselected word list)
  for (var i=0; i < lines.length; i++){
    str = lines[i];
    word_freq = str.split(" ");
    word_list.push({word: word_freq[0], size: Number(word_freq[1])});
  }

  return word_list;
}


// Compare the two distributions (input vs. preselected word list)
async function comp() {

var x = document.getElementById("in1");
var text_string = document.getElementById("in1").value;

if (text_string == "") { // ensure text has been inputed
  x.style.background = "#ff0000";
  setTimeout(function() {
    x.style.background = "white";
  }, 250);
return "";
}
else {

  // Split input string into an array
  text_string = text_string.toLowerCase();
  text_string = text_string.replace(/[.,\/#!$%\^&\*;:{}=0-9\-_`~()\'\"]/g,"");
  text_string = text_string.replace(/\n+|\s+/g," ");
  var word_list = text_string.split(" ");

  if(word_list[word_list.length-1] == "") { // remove last element if empty
    word_list.splice(-1, 1);
  }
}

// Calculate the frequency of each word
var freqs = [];
word_list.forEach(function(x) {
freqs[x] = (freqs[x]||0) + 1;
});


// Create a table/dictionary that lists the word followed by its frequency (input)
var word_list_new = [];
var i = 0;
for (w in freqs) {
  word_list_new[i] = {word: w, size: freqs[w]};
  i ++;
}

// Sort the table/dictionary (high to low frequency)
word_list_new.sort(function(a, b) {
  return b.size - a.size;
});




// Compare the input to the predetermined word list (i.e. get the arrays/frequencies of the same input words that are in the word list)
var word_list_fixed = [];
var word_list_temp = [];

a = document.getElementById("rule_dropdown").value;
word_list_pre = await read_wordlists(a);

word_list_new.forEach(function(x1) {
word_list_pre.forEach(function(x2) {
  if (x1["word"] == x2["word"]) { // search the preselected word list for the input words
    word_list_fixed.push(x2);
    word_list_temp.push(x1);
    word_list_new.splice(x1, 1);
  }
});
});

// If a word in the input string is not in the preexisting word list, include the word in the preselected word list, but set the frequency to 0
word_list_new.forEach(function(x) {
word_list_temp.push(x);
word_list_fixed.push({word: x["word"], size: 0});
});

var word_list_input = word_list_temp;


// Turn the input and fixed word lists into probability distributions

// (1) Calculate the total frequency count for both the input string and the preselected word list
input_total = [];

for (element in word_list_input) {
  entry = word_list_input[element];
  input_total.push(entry["size"]);
}

input_total = input_total.reduce((num_tot, num_new) => num_tot + num_new, 0); // freq total for input


length_fixed = [];

for (element in word_list_pre) {
  entry = word_list_pre[element];
  length_fixed.push(entry["size"]);
}

length_fixed.filter(function(x) { // remove NaN values
  return !Number.isNaN(x);});

// Get total frequency count for length_fixed as with input_total (Note: reduce would not work for some reason, hence the different approach below)
var fixed_total = 0;
for (x in length_fixed) {
  fixed_total += length_fixed[i]; // freq total for preselected word list
}


// (2) Calculate the probabilites (add-one smoothing)
var wc_list_input = [];
var input_prob = [];
var wc_list_fixed = [];
var fixed_prob = [];


for (element in word_list_input) {
  entry = word_list_input[element];
  word = entry["word"];
  prob = (entry["size"] + 1)/(input_total + word_list_input.length + 1); // add-one smoothing - num: count of the word + 1; den: frequency count of entire input string + # of uniqe words in input string + 1
  wc_list_input[element] = {word, prob}; // keep for record of word/probabilities
  input_prob[element] = prob; // records the probabilities
}

for (element in word_list_fixed) {
  entry = word_list_fixed[element];
  word = entry["word"];
  prob = (entry["size"] + 1)/(fixed_total + word_list_pre.length + 1); // add-one smoothing - num: count of the word + 1; den: frequency count of entire word list + # of unique words in word list + 1
  wc_list_fixed[element] = {word, prob}; // keep for record of word/probabilities
  fixed_prob[element] = prob; // records the probabilities
}


// Calculate kl-divergence between the two distributions
var kl = math.kldivergence(fixed_prob, input_prob); // TODO: figure out how to get absolute pointwise kl-divergence


// TODO: figure out how to get absolute pointwise kl-divergence
// For now, I multiply the resulting kl-divergence by the frequencies of the input word_lsit
var wc_word_list = [];
var wc_prob_list = [];

for (i in word_list_input) {
  x = word_list_input[i];
  word = x["word"];
  size = (x["size"] * kl);
  wc_prob_list[i] = size;
  wc_word_list[i] = {word, size};
}

return [wc_word_list, wc_prob_list];
}
