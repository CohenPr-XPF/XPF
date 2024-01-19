

String.prototype.replaceAll = function(search, replacement) {
  var target = this;
  return target.replace(new RegExp(search, 'g'), replacement);
};


function print(val) { console.log(val) }

function dictFormat(s, valueDict) {
  ret = s;

  s.match(/\{[^}]+\}/g).forEach(function(repName){
  key = repName.replace(/[{}]/g, "");
  ret = ret.replace(repName, valueDict[key])
  });
  return ret;
}

function get(url) {
  // Return a new promise.
  return new Promise(function(resolve, reject) {
    // Do the usual XHR stuff
    var req = new XMLHttpRequest();
    req.open('GET', url);

    req.onload = function() {
      // This is called even on 404 etc
      // so check the status
      if (req.status == 200) {
        // Resolve the promise with the response text
        resolve(req.response);
      }
      else {
        // Otherwise reject with the status text
        // which will hopefully be a meaningful error
        reject(Error(req.statusText));
      }
    };

    // Handle network errors
    req.onerror = function() {
      reject(Error("Network Error"));
    };

    // Make the request
    req.send();
  });
}



async function read_rules(filename) {
  // let rawdata = ""
  hidden = document.getElementById('x')
  if (hidden.value.length == 0 || filename != "") {
    // Existing Rules:
    rawdata = await get(filename);
  }
  else {
    // Upload Rules:
    rawdata = hidden.value
  }
  console.log(rawdata)

  const data = rawdata.split("\n");

  let headers = data[0].split(",")
  // Get headers:
  for (var i=0; i<data.length; i++) {
	   if (data[i].length > 0 && data[i][0] != "#") {
	      headers = data[i].split(",")
	      break
	   }
  }
  rule_list = []
  // Get rules:
  for (var i=0; i<data.length; i++) {
	   if (data[i].length > 0 && data[i][0] != "#") {
	      var split_rule = data[i].split(",");
	      if (split_rule[0] != headers[0]) { // ignore header
          var rule_dict = {}
		      for (var j=0; j<headers.length; j++) {
            rule_dict[headers[j]] = split_rule[j]
		      }
		      rule_list.push(rule_dict)
	      }
	   }
   }
   return rule_list;
}

class SubRule {
  constructor(rule, classes) {
	   const headers = ["sfrom", "sto", "precede", "follow", "weight"]
	   for (var i=0; i<headers.length; i++) {
	      let key = headers[i]
	      let value = rule[key]//.replace("\\", "$1")
        if (key == "sto") {
          if (!(value == "@" || value == " @")) {
          value = value.replaceAll(/\\([1-9])/, "@$1").replaceAll("@", "$")
          }
        }

        // control for word boundaries (differences between python and javascript)
        if (key == "sfrom" && value.includes("\\b")) {
          value = value.replace(/\\b$/, "(?=\\s|$)");
          value = value.replace(/^\\b/, "(?<=^|\\s)");
        }

        // value = RegExp(value)
	      const re = new RegExp('{.*}')
	      // Handles classes and subclasses
	      while (re.test(value)) {
		        // Replacement for Python dictionary format() method:
		        // value = value.replace(/[\{\}']+/g,'')
		        // let format_value = value.replace(/[\{\}\(\)\[\]']+/g,'')
		        // value = value.replace(format_value, classes[format_value])
            value = dictFormat(value, classes)
	      }
	      this[key] = value
	    }
	    this.weight = parseFloat(this.weight)
	    this.sfrom_save = this.sfrom
      this.sfrom = new RegExp(this.sfrom)
      this.precede = new RegExp(this.precede+"$")
      this.follow = new RegExp("^"+this.follow)
  }

  sub_score(sfrom, precede, follow) {
	   if (this.sfrom.test(sfrom) && this.precede.test(precede) && this.follow.test(follow)) {
       return this.weight
	   }
     else {
       return null
	   }
  }

  sub(x) {
    return x.replace(this.sfrom, this.sto)
  }
}

class AlphabetToIpa {
  constructor(rule_filepath) {
    this.rulenames = rule_filepath;
    read_rules(this.rulenames).then((rules) => {
      this.rule_list = rules;
      this.init();
    })
  }

  init() {
    this.classes = {}
	  this.subs = new Set([])
	  this.ipasubs = new Set([])
	  this.words = {}
    this.matches = {}
	  this.pre = []
	  this.NO_TRANSLATE = "@"

	  // Iterate over rules:
	  for (var i=0; i<this.rule_list.length; i++) {
      let rule = this.rule_list[i]

      // remove double quotes
      for (const key of Object.keys(rule)) {
        var item = rule[key];
        if (typeof item !== "undefined" && item.match(/^\"\"*/)) {
          item = item.replace(/^\"/, "").replace(/\"$/, "");
          rule[key] = item;
        }
      }

      if (rule["type"] == "pre") {
        this.pre.push([rule["sfrom"], rule["sto"]])
    	}
      else if (rule["type"] == "class") {
        this.classes[rule["sfrom"]] = rule["sto"]
      }
      else if (rule["type"] == "match") {
        var value = rule["sto"]
        const re = new RegExp('{.*}')
        while (re.test(value)) {
          value = dictFormat(value, this.classes)
        }
        this.matches[rule["sfrom"]] = value
      }
      else if (rule["type"] == "sub") {
        let subrule = new SubRule(rule, this.classes)
    		this.subs.add(subrule)
      }
      else if (rule["type"] == "ipasub") {
          let ipasubrule = new SubRule(rule, this.classes)
	  ipasubrule.sfrom = new RegExp(ipasubrule.sfrom, "g");
	  // (ucp2024-01-19: commented out by someone in the past, disabling back reference) ipasubrule.sto = ipasubrule.sto.replace(/\\([1-9])/, "$$1");
	  ipasubrule.sto = ipasubrule.sto.replace(/\\([1-9])/g, "\$$1")
	  ipasubrule.sto = new RexExp(ipasubrule.sto)
    	  this.ipasubs.add(ipasubrule)
      }
      else if (rule["type"] == "word") {
    		this.words[rule["sfrom"]] = rule["sto"].split()
      }
      else {
    		console.log("Unrecognized rule type.")
    	}
	  }
  }

  translate(source) {
    // Check if previously translated:
  	if (source in this.words) {
      return this.words[source]
  	}
    else {
      // Preprocess:
  	  for (var i=0; i<this.pre.length; i++) {
        let prerule = this.pre[i]
  		  source = source.replace(prerule[0], prerule[1])
  	  }
  	  source = source.toLowerCase()

  	  var source_list = source.split("")
      var target_list = []

      // Check for match rules
      if (Object.keys(this.matches).length > 1) {
        if (source.length > 1) {
          for (let letter in source) {
            var match = source[letter];
            for (let item in this.matches) {
              var out = this.matches[item]
              if (match == item) {
                target_list.push(out);
                source_list.pop();
              }
            }
          }
        }
        else {
          for (let item in this.matches) {
            var out = this.matches[item]
            if (source == item) {
              target_list.push(out);
              source_list.pop();
            }
          }
        }
      }

      for (var i=0; i<source_list.length; i++) {
        let sfrom = source_list[i]
        let precede = source_list.slice(0,i).join("")
		    let follow = source_list.slice(i+1).join("")

		    var translations = []
		    this.subs.forEach(function(subrule) {
          let trans = [subrule.sub_score(sfrom, precede, follow), subrule.sub(sfrom)]
          translations.push(trans)
		    })
		    // Exclude translations that didn't apply, and sort by weight:
		    translations = translations.filter(trans => trans[0])

        // Exclude translations that didn't apply, and sort by weight:
        if (translations.length > 0) {
          var translation = translations.sort(function(a,b) { return(b[0] - a[0]) })[0][1]
    	    if (translation.length > 0) {
            target_list.push(translation)
          }
		    }
        else {
          target_list.push(this.NO_TRANSLATE)
		    }
      }
      var target_string = (target_list).join(" ")
      print(target_string)

      var ipa_translations = []
      this.ipasubs.forEach(function(ipasubrule) {
        let ipa_trans = [ipasubrule.weight, ipasubrule]
        ipa_translations.push(ipa_trans)
      })
      ipa_translations = ipa_translations.sort(function(a,b) { return(b[0] - a[0]) })
      for (var i=0; i<ipa_translations.length; i++) {
        let ipasubrule = ipa_translations[i][1];
		    console.log("ipasub", ipasubrule, "from:", target_string);

        target_string = target_string.replace(ipasubrule.sfrom, ipasubrule.sto);
		    console.log("\tresult:", target_string);
      }

	    print(target_string);
      return target_string.split()
  	}
  }
}

//let a2ipa = new AlphabetToIpa("test.rules")
