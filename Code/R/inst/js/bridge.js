// Glue between R and translate04.js. Holds one AlphabetToIpa per loaded
// language/script, keyed by an id chosen on the R side. Everything crossing
// the boundary is a string or a JSON string, so R's JSON conversion never
// reshapes rule data.
var xpfR = (function () {
    'use strict';
    var t = translate04;
    var registry = {};

    // Some V8 builds (R's V8 on Linux, linked without full ICU) leave
    // Georgian Mtavruli capitals (U+1C90-1CBF, Unicode 11) unchanged in
    // toLowerCase(), where Node, browsers and Python map them to Mkhedruli
    // (U+10D0-10FF). translate() lower-cases after `pre`, and no language
    // has a `pre` rule on these letters, so mapping them first gives the
    // same result as an engine that knows the case pair.
    var foldMtavruli = "\u1C90".toLowerCase() === "\u1C90";
    function fold(w) {
        if (!foldMtavruli) return w;
        return w.replace(/[\u1C90-\u1CBA\u1CBD-\u1CBF]/g, function (c) {
            return String.fromCharCode(c.charCodeAt(0) - 0xBC0);
        });
    }

    function load(id, ruleList) {
        registry[id] = new t.AlphabetToIpa(ruleList);
        return true;
    }

    return {
        loadJSON: function (id, text, script) {
            return load(id, t.parseRulesFromJSON(JSON.parse(text), script));
        },
        loadRules: function (id, text) {
            return load(id, t.parseRulesFromString(text));
        },
        has: function (id) {
            return Object.prototype.hasOwnProperty.call(registry, id);
        },
        drop: function (id) {
            delete registry[id];
            return true;
        },
        // words: JSON array of strings. Returns a JSON array of phoneme arrays.
        transcribe: function (id, wordsJSON) {
            var g = registry[id];
            if (!g) throw new Error("no transcriber loaded under id '" + id + "'");
            var words = JSON.parse(wordsJSON);
            return JSON.stringify(words.map(function (w) { return g.translate(fold(w)); }));
        },
        // Split a CSV/TSV text into rows the way the engine reads .rules files.
        parseTable: function (text) {
            text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
            var delim = t.detectDelimiter(text);
            var rows = text.split('\n').filter(function (l) { return l.length > 0; });
            return JSON.stringify(rows.map(function (l) { return t.parseLine(l, delim); }));
        }
    };
})();
