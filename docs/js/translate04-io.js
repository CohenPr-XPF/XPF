/**
 * translate04-io.js - IO bridge for translate04-node.js in the browser.
 *
 * Provides rule loading (XHR and file upload) and creates AlphabetToIpa
 * instances using the translate04 engine. This file depends on
 * translate04-node.js being loaded first (providing window.translate04).
 */

(function(global) {
    'use strict';

    var t04 = global.translate04;
    if (!t04) {
        console.error("translate04-io.js: translate04-node.js must be loaded first");
        return;
    }

    /**
     * Fetch a URL and return the text content via a Promise.
     */
    function fetchText(url) {
        return new Promise(function(resolve, reject) {
            var req = new XMLHttpRequest();
            req.open('GET', url);
            req.onload = function() {
                if (req.status === 200) {
                    resolve(req.response);
                } else {
                    reject(new Error(req.statusText));
                }
            };
            req.onerror = function() {
                reject(new Error("Network Error"));
            };
            req.send();
        });
    }

    /**
     * Load rules from a URL and create an AlphabetToIpa instance.
     * Returns a Promise that resolves with the translator.
     */
    function loadFromUrl(url) {
        return fetchText(url).then(function(rulesText) {
            var ruleList = t04.parseRulesFromString(rulesText);
            return new t04.AlphabetToIpa(ruleList);
        });
    }

    /**
     * Load rules from a string (e.g., from a file upload) and
     * create an AlphabetToIpa instance.
     */
    function loadFromString(rulesText) {
        var ruleList = t04.parseRulesFromString(rulesText);
        return new t04.AlphabetToIpa(ruleList);
    }

    /**
     * Read a File object and return a Promise with its text content.
     */
    function readFile(file) {
        return new Promise(function(resolve, reject) {
            var reader = new FileReader();
            reader.onloadend = function(e) {
                resolve(e.target.result);
            };
            reader.onerror = function(e) {
                reject(e);
            };
            reader.readAsText(file);
        });
    }

    /**
     * Detect file format from filename extension or content sniffing.
     * Returns "rules", "json", or "yaml".
     */
    function detectFormat(filename, content) {
        if (filename) {
            var ext = filename.split('.').pop().toLowerCase();
            if (ext === 'json') return 'json';
            if (ext === 'yaml' || ext === 'yml') return 'yaml';
            if (ext === 'rules') return 'rules';
        }
        // Content sniffing: try JSON
        if (content) {
            var trimmed = content.trim();
            if (trimmed[0] === '{') return 'json';
        }
        return 'rules';
    }

    /**
     * Load rules from any supported format (rules, JSON, YAML).
     * Returns { grammar, metadata, scriptNames, defaultScript, selectedScript, jsonObj }
     *
     * For .rules files: metadata/scriptNames/jsonObj will be null.
     * For JSON/YAML: full xpfcorpus introspection data is returned.
     *
     * @param {string} content - File content as text
     * @param {string} filename - Original filename (for format detection)
     * @param {string} [scriptName] - Script to load (JSON/YAML only; null = default)
     */
    function loadFromAnyFormat(content, filename, scriptName) {
        var format = detectFormat(filename, content);

        if (format === 'rules') {
            return {
                grammar: loadFromString(content),
                metadata: null,
                scriptNames: null,
                defaultScript: null,
                selectedScript: null,
                jsonObj: null
            };
        }

        // Parse JSON or YAML
        var jsonObj;
        if (format === 'json') {
            jsonObj = JSON.parse(content);
        } else {
            // YAML: requires js-yaml to be loaded (via CDN)
            if (!global.jsyaml) {
                throw new Error("js-yaml library is required for YAML files. Include the js-yaml CDN script.");
            }
            jsonObj = global.jsyaml.load(content);
        }

        var info = t04.parseXPFJSON(jsonObj);
        var selected = scriptName || info.defaultScript;
        var ruleList = t04.parseRulesFromJSON(jsonObj, selected);
        var grammar = new t04.AlphabetToIpa(ruleList);

        return {
            grammar: grammar,
            metadata: info.metadata,
            scriptNames: info.scriptNames,
            defaultScript: info.defaultScript,
            selectedScript: selected,
            jsonObj: jsonObj
        };
    }

    // Export
    global.translate04io = {
        fetchText: fetchText,
        loadFromUrl: loadFromUrl,
        loadFromString: loadFromString,
        loadFromAnyFormat: loadFromAnyFormat,
        detectFormat: detectFormat,
        readFile: readFile
    };

})(typeof window !== 'undefined' ? window : this);
