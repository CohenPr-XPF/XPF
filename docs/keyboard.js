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
      if(x["sfrom_save"].includes("[") && !(x["sto"] == "") && !(x["sfrom_save"] == " ")) { // don't want to include characters that translate to nothing (most likely punct) (TODO: double check)
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

    console.log(orthography);

    for(let x of grammar.rule_list) { // Retrieves input characters from listed sub rules (and class rules from the exceptions described below)
      if(x.type == "sub" && !(x.sfrom.includes("{"))) { // "{}" indicate references to different class rules, which I have accounted for above
        if(x.sfrom != "-"|","|"'" && x.sto != "") { // excludes punctuation and characters that translate to nothing
          //console.log(x.sfrom);
          orthography[x.sfrom] = 1;
        }
        if(x.sfrom.match(/^\p{Ll}$/u) && (x.follow.match(/^\p{Ll}$/u) || x.follow.match(/^\p{Ll}\{/u))) {
          if(x.follow.match(/^\p{Ll}\{/u)) {
            temp = x.follow;
            temp = temp[0];
            orthography[temp] = 1;
          }
          else {
            orthography[x.follow] = 1;
          }
        }
        if(x.sfrom.match(/^\p{Ll}$/u) && (x.precede.match(/^\p{Ll}$/u) || x.precede.match(/^\p{Ll}\{/u))) {
          if(x.precede.match(/^\p{Ll}\{/u)) {
            temp = x.precede;
            temp=temp[0];
            orthography[temp] = 1;
          }
          else {
            orthography[x.precede] = 1;
          }
        }
      }
      if(x.type == "class" && (x.sfrom.includes("sukun") || x.sfrom.includes("madda") || x.sfrom.includes("dia-hamza-below"))) { // exception: controls for languages that use Devanagari script (symbol omits inherent vowel)
        str = x.sto;
        str = str.replace(/[/\(\)\[\]]/g, "");
        orthography[str] = 1;
      }
    }

    console.log(orthography);

    var buff = "";
    for (letter in orthography) {
      buff = buff + letter + ",";
    }

    buff = buff.replaceAll(",$", "");
    buff = buff.split(",");
    buff = buff.sort(); // sort keyboard alphabetically (should apply to most UTF-8 scripts) (TODO: double check)

    console.log(buff.length);
    return buff;
  }
