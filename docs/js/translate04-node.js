#!/usr/bin/env node

/**
 * translate04.js - Translate words to IPA
 * 
 * Usage (Node.js command line):
 *   node translate04.js -l <langrules> [-c <checkfile>] [-v <level>] [words...]
 * 
 * Usage (Browser):
 *   Include this script and call:
 *   - parseRulesFromString(rulesText) to get a rule list
 *   - new AlphabetToIpa(ruleList) to create a translator
 *   - translator.translate(word) to translate words
 */

(function(exports) {
    'use strict';

    //
    // Utility function: replace all occurrences (works with both string and regex)
    //
    function replaceAllOccurrences(str, search, replacement) {
        if (typeof search === 'string') {
            return str.split(search).join(replacement);
        } else {
            // Ensure global flag for regex
            const flags = search.flags.includes('g') ? search.flags : search.flags + 'g';
            const globalRegex = new RegExp(search.source, flags);
            return str.replace(globalRegex, replacement);
        }
    }

    //
    // Utility functions
    //
    
    // Parse a line using the given delimiter, with quote handling
    function parseLine(line, delimiter) {
        if (delimiter === undefined) {
            // Legacy: auto-detect per line (kept for backward compat)
            delimiter = line.includes('\t') ? '\t' : ',';
        }

        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    // Escaped quote
                    current += '"';
                    i++;
                } else {
                    // Toggle quote mode
                    inQuotes = !inQuotes;
                }
            } else if (char === delimiter && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current);

        return result;
    }

    // Detect if file content is tab-separated or comma-separated.
    // Matches Python's sniff() logic: if ALL non-comment lines have tabs → TSV,
    // otherwise → CSV.
    function detectDelimiter(rawdata) {
        const lines = rawdata.split('\n');
        const dataLines = [];
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.length > 0 && line[0] !== '#') {
                dataLines.push(line);
            }
        }
        if (dataLines.length > 0 && dataLines.every(l => l.includes('\t'))) {
            return '\t';
        }
        return ',';
    }

    function dictFormat(s, valueDict) {
        let ret = s;
        const matches = s.match(/\{[^}]+\}/g);
        if (matches) {
            matches.forEach(function(repName) {
                const key = repName.replace(/[{}]/g, "");
                ret = ret.replace(repName, valueDict[key]);
            });
        }
        return ret;
    }

    //
    // Parse rules from a string (CSV or TSV format)
    //
    function parseRulesFromString(rawdata) {
        // Normalize line endings (handle CRLF, CR, LF)
        rawdata = rawdata.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        const delimiter = detectDelimiter(rawdata);
        const data = rawdata.split("\n");

        let headers = [];
        // Get headers (first non-empty, non-comment line):
        for (let i = 0; i < data.length; i++) {
            const line = data[i].trim();
            if (line.length > 0 && line[0] !== "#") {
                headers = parseLine(line, delimiter);
                break;
            }
        }

        const rule_list = [];
        // Get rules:
        for (let i = 0; i < data.length; i++) {
            const line = data[i].trim();
            if (line.length > 0 && line[0] !== "#") {
                const split_rule = parseLine(data[i], delimiter);
                if (split_rule[0] !== headers[0]) { // ignore header
                    const rule_dict = {};
                    for (let j = 0; j < headers.length; j++) {
                        rule_dict[headers[j]] = split_rule[j];
                    }
                    rule_list.push(rule_dict);
                }
            }
        }

        return rule_list;
    }

    //
    // SubRule class
    //
    class SubRule {
        constructor(rule, classes) {
            const headers = ["sfrom", "sto", "precede", "follow", "weight"];
            for (let i = 0; i < headers.length; i++) {
                const key = headers[i];
                let value = rule[key] || "";
                
                if (key === "sto") {
                    if (!(value === "@" || value === " @")) {
                        // Convert backreferences: \1 -> $1
                        value = replaceAllOccurrences(value, /\\([1-9])/, '%$1');
                        value = replaceAllOccurrences(value, '%', '$');
                    }
                }

                // Control for word boundaries (differences between Python and JavaScript)
                if (key === "sfrom" && value.includes("\\b")) {
                    value = value.replace(/\\b$/, "(?=\\s|$)");
                    value = value.replace(/^\\b/, "(?<=^|\\s)");
                }

                // Handle classes and subclasses
                const re = new RegExp('{.*}');
                while (re.test(value)) {
                    value = dictFormat(value, classes);
                }
                this[key] = value;
            }
            
            this.weight = parseFloat(this.weight) || 0;
            this.sfrom_save = this.sfrom;
            this.sfrom = new RegExp(this.sfrom);
            this.precede = new RegExp(this.precede + "$");
            this.follow = new RegExp("^" + this.follow);
        }

        sub_score(sfrom, precede, follow) {
            if (this.sfrom.test(sfrom) && this.precede.test(precede) && this.follow.test(follow)) {
                return this.weight;
            } else {
                return null;
            }
        }

        sub(x) {
            return x.replace(this.sfrom, this.sto);
        }
    }

    //
    // AlphabetToIpa class
    //
    class AlphabetToIpa {
        constructor(rule_list, options = {}) {
            this.loglevel = options.loglevel || 0;
            this.NO_TRANSLATE = options.missing || "@";
            this.rule_list = rule_list;
            this.init();
        }
        
        init() {
            this.classes = {};
            this.subs = new Set([]);
            this.ipasubs = new Set([]);
            this.words = {};
            this.matches = {};
            this.pre = {};  // Changed to object for character-by-character mapping
            
            // Iterate over rules:
            for (let i = 0; i < this.rule_list.length; i++) {
                let rule = this.rule_list[i];

                // Remove double quotes
                for (const key of Object.keys(rule)) {
                    let item = rule[key];
                    if (typeof item !== "undefined" && item.match && item.match(/^\"\"*/)) {
                        item = item.replace(/^\"/, "").replace(/\"$/, "");
                        rule[key] = item;
                    }
                }

                try {
                    if (rule["type"] === "pre") {
                        // Build character-by-character mapping like Python's str.maketrans
                        const sfrom = rule["sfrom"] || "";
                        const sto = rule["sto"] || "";
                        const sfromChars = Array.from(sfrom);  // Handle Unicode properly
                        const stoChars = Array.from(sto);
                        for (let j = 0; j < sfromChars.length && j < stoChars.length; j++) {
                            this.pre[sfromChars[j]] = stoChars[j];
                        }
                    }
                    else if (rule["type"] === "class") {
                        this.classes[rule["sfrom"]] = rule["sto"];
                    }
                    else if (rule["type"] === "match") {
                        let value = rule["sto"];
                        const re = new RegExp('{.*}');
                        while (re.test(value)) {
                            value = dictFormat(value, this.classes);
                        }
                        this.matches[rule["sfrom"]] = value;
                    }
                    else if (rule["type"] === "sub") {
                        const subrule = new SubRule(rule, this.classes);
                        this.subs.add(subrule);
                    }
                    else if (rule["type"] === "ipasub") {
                        const ipasubrule = new SubRule(rule, this.classes);
                        ipasubrule.sfrom = new RegExp(ipasubrule.sfrom, "g");
                        this.ipasubs.add(ipasubrule);
                    }
                    else if (rule["type"] === "word") {
                        // Fix: use split(" ") instead of split()
                        this.words[rule["sfrom"]] = rule["sto"].split(" ");
                    }
                    else {
                        if (this.loglevel >= 0) {
                            console.error("Unrecognized rule type: " + rule["type"]);
                        }
                    }
                    
                    if (this.loglevel > 1) {
                        console.error("Rule added:", rule);
                    }
                } catch (ex) {
                    console.error("Error processing rule:", rule, ex);
                }
            }
        }

        translate(source) {
            // Check if whole word match exists:
            if (source in this.words) {
                return this.words[source];
            }
            
            // Preprocess: apply character-by-character mapping (like Python's str.translate)
            if (Object.keys(this.pre).length > 0) {
                source = Array.from(source).map(char => {
                    return this.pre[char] !== undefined ? this.pre[char] : char;
                }).join('');
            }
            source = source.toLowerCase();
            
            if (this.loglevel > 2) {
                console.error("After pre and lower: " + source);
            }
            
            const source_list = source.split("");
            const target_list = [];
            
            for (let i = 0; i < source_list.length; i++) {
                const sfrom = source_list[i];
                const precede = source_list.slice(0, i).join("");
                const follow = source_list.slice(i + 1).join("");
                
                let translation;

                if (sfrom in this.matches) {
                    translation = this.matches[sfrom];
                } else {
                    const translations = [];
                    this.subs.forEach(function(subrule) {
                        const trans = [subrule.sub_score(sfrom, precede, follow), subrule.sub(sfrom)];
                        translations.push(trans);
                    });
                    
                    // Exclude translations that didn't apply:
                    const valid_translations = translations.filter(trans => trans[0] !== null);
                    
                    // Choose best translation (sort by weight desc, then by result desc for tiebreaker)
                    if (valid_translations.length > 0) {
                        translation = valid_translations.sort(function(a, b) { 
                            if (b[0] !== a[0]) {
                                return b[0] - a[0];  // Higher weight first
                            }
                            // Tiebreaker: compare translation strings (higher Unicode value wins)
                            if (a[1] < b[1]) return 1;
                            if (a[1] > b[1]) return -1;
                            return 0;
                        })[0][1];
                    } else {
                        translation = this.NO_TRANSLATE;
                    }
                }
                
                if (translation.length > 0) {
                    target_list.push(translation);
                }
            }
            
            let target_string = target_list.join(" ");
            
            // Apply ipasub rules (sorted by weight, highest first)
            const ipa_translations = [];
            this.ipasubs.forEach(function(ipasubrule) {
                ipa_translations.push([ipasubrule.weight, ipasubrule]);
            });
            ipa_translations.sort(function(a, b) { return b[0] - a[0]; });
            
            for (let i = 0; i < ipa_translations.length; i++) {
                const ipasubrule = ipa_translations[i][1];
                if (this.loglevel > 2) {
                    console.error("ipasub from:", target_string);
                }
                target_string = target_string.replace(ipasubrule.sfrom, ipasubrule.sto);
                if (this.loglevel > 2) {
                    console.error("\tresult:", target_string);
                }
            }
            
            // Fix: split on whitespace and filter empty strings (like Python's split())
            return target_string.trim().split(/\s+/).filter(s => s.length > 0);
        }

        check(verifyData) {
            // verifyData is an array of lines from the verification file
            // Detect delimiter for the whole file (matching Python's sniff)
            const verifyText = verifyData.join('\n');
            const delimiter = detectDelimiter(verifyText);
            let allGood = true;

            for (let i = 0; i < verifyData.length; i++) {
                const line = verifyData[i].trim();
                if (line.length === 0 || line[0] === "#") {
                    continue;
                }

                // Use parseLine with detected delimiter
                let values = parseLine(line, delimiter);
                if (values.length < 2) {
                    continue;
                }
                
                // Trim whitespace from all fields
                values = values.map(v => v.trim());
                
                try {
                    const word = values[0];
                    const shouldbe = values[1];
                    const translation = this.translate(word).join(" ");
                    
                    if (this.loglevel > 2) {
                        console.error(`Does '${word}' translate to '${shouldbe}'?`);
                    }
                    
                    if (shouldbe !== translation) {
                        allGood = false;
                        if (this.loglevel >= 0) {
                            const comment = values.length > 2 ? `\t${values[2]}` : '';
                            console.error(`Verification error, '${word}\t${shouldbe}${comment}' was translated to '${translation}', not '${shouldbe}'`);
                        }
                    }
                    
                    if (this.loglevel > 0) {
                        console.error(`Word '${word} (${shouldbe})' translated to '${translation}'`);
                    }
                } catch (ex) {
                    allGood = false;
                    console.error("Error processing verification line:", values, ex);
                }
            }
            
            return allGood;
        }
    }

    //
    // Export for browser/module use
    //
    exports.parseRulesFromString = parseRulesFromString;
    exports.parseLine = parseLine;
    exports.detectDelimiter = detectDelimiter;
    exports.SubRule = SubRule;
    exports.AlphabetToIpa = AlphabetToIpa;
    exports.dictFormat = dictFormat;

})(typeof exports === 'undefined' ? (this.translate04 = {}) : exports);


//
// Node.js command-line interface
//
if (typeof require !== 'undefined' && require.main === module) {
    const fs = require('fs');
    const path = require('path');
    
    function parseArgs(args) {
        const options = {
            langrules: 'es.rules',
            check: null,
            read: null,
            loglevel: 0,
            words: []
        };
        
        let i = 0;
        while (i < args.length) {
            const arg = args[i];
            
            if (arg === '-l' || arg === '--langrules') {
                options.langrules = args[++i];
            } else if (arg === '-c' || arg === '--check') {
                options.check = args[++i];
            } else if (arg === '-r' || arg === '--read') {
                options.read = args[++i];
            } else if (arg === '-v' || arg === '--verbose') {
                options.loglevel = parseInt(args[++i]) || 0;
            } else if (arg === '-h' || arg === '--help') {
                console.log(`Usage: node ${path.basename(process.argv[1])} [options] [words...]

Options:
  -l, --langrules FILE   Language rules file (default: es.rules)
  -c, --check FILE       Verification file
  -r, --read FILE        Read words from file (one per line)
  -v, --verbose LEVEL    Verbosity level (0-3)
  -h, --help             Show this help message
`);
                process.exit(0);
            } else if (!arg.startsWith('-')) {
                options.words.push(arg);
            }
            i++;
        }
        
        return options;
    }
    
    function main() {
        const args = process.argv.slice(2);
        const options = parseArgs(args);
        
        // Read and parse rules file
        let rulesText;
        try {
            rulesText = fs.readFileSync(options.langrules, 'utf8');
        } catch (ex) {
            console.error(`Error reading rules file '${options.langrules}':`, ex.message);
            process.exit(1);
        }
        
        const ruleList = exports.parseRulesFromString(rulesText);
        const a2ipa = new exports.AlphabetToIpa(ruleList, { loglevel: options.loglevel });
        
        // Run verification if specified
        if (options.check) {
            let checkText;
            try {
                checkText = fs.readFileSync(options.check, 'utf8');
            } catch (ex) {
                console.error(`Error reading check file '${options.check}':`, ex.message);
                process.exit(1);
            }
            
            // Normalize line endings (handle CRLF, CR, LF)
            checkText = checkText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
            const checkLines = checkText.split('\n');
            const allGood = a2ipa.check(checkLines);
            
            if (!allGood) {
                console.error("Verification failed, not processing additional data");
                process.exit(1);
            }
        }
        
        // Collect words to translate
        let words = options.words.slice();
        
        // Read words from file if specified
        if (options.read) {
            try {
                let readText = fs.readFileSync(options.read, 'utf8');
                // Normalize line endings (handle CRLF, CR, LF)
                readText = readText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
                const readWords = readText.split('\n')
                    .map(line => line.replace(',', ' ').split(/\s+/)[0])
                    .filter(word => word && word.length > 0);
                words = words.concat(readWords);
            } catch (ex) {
                console.error(`Error reading file '${options.read}':`, ex.message);
                process.exit(1);
            }
        }
        
        // Translate and output
        for (const word of words) {
            const translation = a2ipa.translate(word).join(" ");
            console.log(`${word}\t${translation}`);
        }
    }
    
    main();
}
