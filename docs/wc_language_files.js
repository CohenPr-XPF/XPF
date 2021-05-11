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

// Parse and format word list file
async function read_wordlists(filename) {

  if (!filename) { // ensure file exists
    alert("Error: No file is listed for the language");
    return;
  }

  var rawdata = await get(filename);
  var lines = rawdata.split("\n");
  var ret_word_list = [];
  var lines2 = [];

  // Exclude word/frequency entries where capital letters are present (TODO: verify)
  for (line in lines) {
    if (lines[line].match(/.*\p{Lu}.*/gu) == null) {
      lines2.push(lines[line]);
    }
  }

  // Create a table/dictionary that lists the word followed by its frequency
  for (var i=0; i < lines2.length; i++){
    str = lines2[i];
    word_freq = str.split(" ");
    ret_word_list.push({word: word_freq[0], size: Number(word_freq[1])});
  }

  // Remove entries with either "blank" words or null frequency values
  for (entry in ret_word_list) {
    x = ret_word_list[entry]
    if (x.word == "" || Number.isNaN(x.size)){
      ret_word_list.splice(entry, 1);
    }
  }

  //console.log(ret_word_list);
  return ret_word_list;
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

    if(word_list[word_list.length-1] == "") { // remove last element if empty
      word_list.splice(-1, 1);
    }
  }

  // Calculate the frequency of each word
  var freqs = {};
  var freq_val;

  for (var i=0; i < word_list.length; i++){
    freq_val = word_list[i];
    if (freq_val in freqs) {
      freqs[freq_val]++;
    }
    else {
      freqs[freq_val] = 1;
    }
  }

  // Eliminate duplicates (i.e. create array with unique words)
  var no_dups = [];
  for (freq_val in freqs) {
    no_dups.push(freq_val);
  }

  function orderfreq(a, b) { // function to sort word list from highest to lowest frequency
    return freqs[b] - freqs[a];
  }
  no_dups.sort(orderfreq); // sort word list from highest to lowest frequency

  // Format user input word/freq info to be the same as that of the preselected word list
  var new_list = [];
  for (word in no_dups) {
    word = no_dups[word];
    new_list.push({word: word, size: freqs[word]});
  }

  return new_list;
}


// Compare the input text to the predetermined word list
async function comp() {

  a = document.getElementById("rule_dropdown").value;
  word_list_new = read_input();
  word_list_pre = await read_wordlists(a);

  //console.log(word_list_new)
  //console.log(word_list_pre)

  var word_list_input = [];

  word_list_new.forEach(function(x1, i) {
    word_list_pre.forEach(function(x2) {
      if (x1["word"] == x2["word"]) { // search the preselected word list for the input words
        word_list_input.push(x1); // create array of matched words with the user's word list frequencies
        word_list_new.splice(i, 1); // once a match has been found with a user's input word, remove that word from the initial list
      }
    });
  });

  initial_prelength = word_list_pre.length; // get length prior to adding the "empty" entries below

  // If a word in the input string is not in the preselected word list, include the word in the preselected word list, but set the frequency to 0
  word_list_new.forEach(function(x) { // word_list_new now contains all user input words that weren't previously matched
    word_list_input.push(x);
    word_list_pre.push({word: x["word"], size: 0});
  });

  //console.log(word_list_pre);
  //console.log(word_list_input);

  // Turn the input and fixed word lists into probability distributions
  // (1) Calculate the total frequency count for both the input string and the preselected word list
  input_total = [];

  for (element in word_list_input) {
    entry = word_list_input[element];
    input_total.push(entry["size"]);
  }

  input_total = input_total.reduce((num_tot, num_new) => num_tot + num_new, 0); // freq total for input list

  fixed_total = [];

  for (element in word_list_pre) {
    entry = word_list_pre[element];
    fixed_total.push(entry["size"]);
  }

  fixed_total = fixed_total.reduce((num_tot, num_new) => num_tot + num_new, 0); // freq total for fixed list (including all words in preselected lists, not just the matched ones)

  //console.log(input_total);
  //console.log(fixed_total);

  // (2) Calculate the probabilites (with add-one smoothing)
  var input_list_probs = [];
  var pre_list_probs = []

  for (element in word_list_input) {
    entry = word_list_input[element];
    word = entry["word"];
    prob = (entry["size"] + 1) / (input_total + word_list_input.length + 1); // add-one smoothing - num: count of the word + 1; den: frequency count of entire input string + # of uniqe words in input string + 1
    input_list_probs[element] = {word, prob};
  }

  for (element in word_list_pre) {
    entry = word_list_pre[element];
    word = entry["word"];
    prob = (entry["size"] + 1)/(fixed_total + initial_prelength + 1); // add-one smoothing - num: count of the word + 1; den: frequency count of entire word list + # of unique words in word list + 1
    pre_list_probs[element] = {word, prob};
  }

  //console.log(input_list_probs);
  //console.log(pre_list_probs);

  // (3) Calculate the pointwise kl-divergence between the two distributions
  var docProb;
  var corpusProb;
  var kl_value;
  var kl_vals = [];
  var kl_pos = []; // for words and values
  var kl_posvals = []; // for values only
  var kl_neg = []; // for words and values
  var kl_negvals = []; // for values only
  var wc_word_list = [];

  for (entry1 in input_list_probs) {
    docProb = input_list_probs[entry1];
    docProb_word = docProb["word"];
    for (entry2 in pre_list_probs) {
      corpusProb = pre_list_probs[entry2];
      corpusProb_word = corpusProb["word"];

      if (docProb_word == corpusProb_word) {

        kl_value = docProb["prob"] * Math.log(docProb["prob"] / corpusProb["prob"]);
        kl_vals[entry1] = kl_value;
        wc_word_list.push({word: docProb["word"], kl: kl_value});

        if (kl_value > 0) {
          kl_pos.push({word: docProb["word"], kl: kl_value});
          kl_posvals[entry1] = kl_value;
        }
        else {
          kl_neg.push({word: docProb["word"], kl: kl_value});
          kl_negvals[entry1] = Math.abs(kl_value); // need absolute value for word size in word cloud(s)
        }
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
