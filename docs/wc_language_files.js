/* WC File Parser and Word List Calcs*/

// Create XMLHttpRequest request in order to read word list files for each language
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

// Parse and format word list file
async function read_wordlists(filename) {

  if (!filename) { // ensure file exists
    alert("Error: No file is listed for the language");
    return;
  }

  var rawdata = await get(filename);
  var lines = rawdata.split("\n");
  var word_list = {};
  var lines2 = [];

  // Exclude word/frequency entries where capital letters are present
  for (line in lines) {
    if (lines[line].match(/.*\p{Lu}.*/gu) == null) {
      lines2.push(lines[line]);
    }
  }

  // Create a dictionary that lists word/frequency key value pairs
  for (var i=0; i < lines2.length; i++){
    str = lines2[i];
    word_freq = str.split(" ");
    word_list[word_freq[0]] = Number(word_freq[1]);
  }

  // Remove blank entries or those with no recorded frequency
  delete word_list[""];
  for(word in word_list) {
    if (Number.isNaN(word_list[word])){
      delete word_list[word];
    }
  };

  return word_list;
}

// Parse and format input text
function read_input() {

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

    // Split input string into an array (excluding punctuation)
    text_string = text_string.toLowerCase();
    text_string = text_string.replace(/[.,\/#!$%\^&\*;:{}=0-9\-_`~()\'\"\[\]]/g,"");
    text_string = text_string.replace(/\n+|\s+/g," ");
    var word_list = text_string.split(" ");

    if(word_list[word_list.length - 1] == "") { // remove last element if empty
      word_list.splice(-1, 1);
    }
  }

  // Calculate the frequency of each word
  var freqs = {};

  for (var i=0; i < word_list.length; i++){
    var freq_val = word_list[i];
    if (freq_val in freqs) {
      freqs[freq_val]++;
    }
    else {
      freqs[freq_val] = 1;
    }
  }

  function orderfreq(a, b) { // function to sort word list from highest to lowest frequency
    return freqs[b] - freqs[a];
  }
  Object.keys(freqs).sort(orderfreq); // sort word list from highest to lowest frequency

  return freqs;
}


// Compare the input text to the predetermined word list
async function comp() {

  a = document.getElementById("rule_dropdown").value;
  word_list_new = read_input();
  word_list_pre = await read_wordlists(a);

  var word_list_input = {};

  for (word in word_list_new) {
    if (word_list_pre.hasOwnProperty(word)) { // search the preselected word list for the input words
      word_list_input[word] = word_list_new[word]; // create dictionary of matched words with the user's word list frequencies
      delete word_list_new[word] // once a match has been found with a user's input word, remove that word from the initial list
    }
  }

  initial_prelength = Object.keys(word_list_pre).length // get length prior to adding the "empty" entries below

  // If a word in the input string is not in the preselected word list, include the word in the preselected word list, but set the frequency to 0
  for (word in word_list_new) { // word_list_new now contains all user input words that weren't previously matched
    word_list_input[word] = word_list_new[word];
    word_list_pre[word] = 0;
  }

  // Turn the input and fixed word lists into probability distributions
  // (1) Calculate the total frequency count for both the input string and the preselected word list

  input_total = Object.values(word_list_input).reduce((num_tot, num_new) => num_tot + num_new, 0); // freq total for input list
  fixed_total = Object.values(word_list_pre).reduce((num_tot, num_new) => num_tot + num_new, 0); // freq total for fixed list (including all words in preselected lists, not just the matched ones)

  // (2) Calculate the probabilites (with add-one smoothing)
  var input_list_probs = {};
  var pre_list_probs = {}

  for (word in word_list_input) {
    prob = (word_list_input[word] + 1) / (input_total + Object.keys(word_list_input).length + 1); // add-one smoothing - num: count of the word + 1; den: frequency count of entire input string + # of uniqe words in input string + 1
    input_list_probs[word] = prob;
  }

  for (word in word_list_pre) {
    prob = (word_list_pre[word] + 1) / (fixed_total + initial_prelength + 1); // add-one smoothing - num: count of the word + 1; den: frequency count of entire word list + # of unique words in word list + 1
    pre_list_probs[word] = prob;
  }

  // (3) Calculate the pointwise kl-divergence between the two distributions
  var kl_value;
  var kl_vals = [];
  var kl_pos = []; // for words and values
  var kl_posvals = []; // for values only
  var kl_neg = []; // for words and values
  var kl_negvals = []; // for values only
  var wc_word_list = [];

  for (word in input_list_probs) {
    if (pre_list_probs.hasOwnProperty(word)) {
      kl_value = input_list_probs[word] * Math.log(input_list_probs[word] / pre_list_probs[word]);
      kl_vals.push(kl_value);
      wc_word_list.push({word: word, kl: kl_value});

      if (kl_value > 0) {
        kl_pos.push({word: word, kl: kl_value});
        kl_posvals.push(kl_value);
      }
      else {
        kl_neg.push({word: word, kl: kl_value});
        kl_negvals.push(Math.abs(kl_value)); // need absolute value for word size in word cloud(s)
      }
    }
  }

  //console.log(wc_word_list)
  //console.log(kl_pos);
  //console.log(kl_neg);
  //console.log(kl_negvals);

  // wc_word_list and kl_vals aren't necessarily needed any further, but I kept them for access
  return [kl_pos, kl_posvals, kl_neg, kl_negvals, wc_word_list, kl_vals];
}
