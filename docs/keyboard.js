/* Grammar Keyboard */


// Update input textarea upon letter button clicks (within user interface)
function temp_keyboard() {
  letter = this.id;
  wchar = orthography[letter];
  document.getElementById("in1").value = document.getElementById("in1").value + wchar;
}

var orthography = [];

// Make keyboard depending on selected/uploaded grammar
function make_keyboard(grammar) {

  document.getElementById("load").style.display = "none";

  orthography = get_grammar(grammar);
  document.getElementById("keyboard").style.display = "";
  var keyboard = document.getElementById("keyboard");

  for (letter in orthography) {

    var key = document.createElement("div");
    key.id = letter;
    key.innerHTML = orthography[letter];
    key.onclick = temp_keyboard;
    key.className = "kb";

    keyboard.appendChild(key);
    }
  }

// Get grammar (retrieve an array of the allowable/translatable input letters)
  function get_grammar(grammar){

    var orthography = [];
    var ap = "";

    for (let x of grammar.subs) { // Retreives input characters from listed class rules (e.g. passthrough)
      if(x["sfrom_save"].includes("[") && !(x["sto"] == "")) { // don't want to include characters that translate to nothing (most likely punct) (TODO: double check)
        str = x["sfrom_save"];

        if(x["sfrom_save"].includes("'")) { // for languages that have apostrophes, the rules account for several UTF-8 types - we just want one to be displayed
          ap = x["sfrom_save"];
          str = str.replace(ap, "");
          ap = ap.replace(ap, "'");
        }

        str = str + ap;
        str = str.replace(/[/\(\)\[\]]/g, "");

        for (i in str) {
          orthography[str[i]] = 1;
        }
      }
    }

    for(let x of grammar.rule_list) { // Retrieves input characters from listed sub rules
      if(x.type == "sub" && !(x.sfrom.includes("{"))) { // "{}" indicate references to different class rules, which I have accounted for above
        if(x.sfrom != "-"|","|"'" && x.sto != "") { // excludes punctuation and characters that translate to nothing
          orthography[x.sfrom] = 1;
        }
      }
    }

    var buff = "";
    for (letter in orthography) {
      buff = buff + letter + ",";
    }

    buff = buff.replaceAll(",$", "");
    buff = buff.split(",");
    buff = buff.sort(); // sort keyboard alphabetically (should apply to most UTF-8 scripts) (TODO: double check)

    return buff;
  }
