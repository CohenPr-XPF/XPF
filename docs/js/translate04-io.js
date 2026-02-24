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

    // Export
    global.translate04io = {
        fetchText: fetchText,
        loadFromUrl: loadFromUrl,
        loadFromString: loadFromString,
        readFile: readFile
    };

})(typeof window !== 'undefined' ? window : this);
