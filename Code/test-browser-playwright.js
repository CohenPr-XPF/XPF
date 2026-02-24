#!/usr/bin/env node
/**
 * Browser-based verification using Playwright.
 *
 * Starts a local HTTP server serving docs/, opens test-verify.html in headless
 * Chromium, clicks "Run All Languages", waits for completion, and reports
 * pass/fail results.
 *
 * Usage:
 *   npx --package=playwright node Code/test-browser-playwright.js
 *   # or, if playwright is installed locally:
 *   node Code/test-browser-playwright.js
 */

var http = require('http');
var fs = require('fs');
var path = require('path');

var SCRIPT_DIR = __dirname;
var REPO_DIR = path.dirname(SCRIPT_DIR);
var DOCS_DIR = path.join(REPO_DIR, 'docs');
var PORT = 8787;
var TEST_URL = 'http://localhost:' + PORT + '/test-verify.html';
var TIMEOUT_MS = 300000; // 5 minutes for all languages

// Simple static file server for docs/
function createServer() {
    var mimeTypes = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.json': 'application/json',
        '.css': 'text/css',
        '.csv': 'text/csv',
        '.txt': 'text/plain',
        '.rules': 'text/plain',
    };

    return http.createServer(function(req, res) {
        var filePath = path.join(DOCS_DIR, decodeURIComponent(req.url));
        if (filePath.endsWith('/')) filePath += 'index.html';

        if (!filePath.startsWith(DOCS_DIR)) {
            res.writeHead(403);
            res.end();
            return;
        }

        fs.readFile(filePath, function(err, data) {
            if (err) {
                res.writeHead(404);
                res.end('Not found: ' + req.url);
                return;
            }
            var ext = path.extname(filePath).toLowerCase();
            var contentType = mimeTypes[ext] || 'application/octet-stream';
            res.writeHead(200, { 'Content-Type': contentType + '; charset=utf-8' });
            res.end(data);
        });
    });
}

async function main() {
    // Load playwright
    var pw;
    try { pw = require('playwright'); } catch (e) {
        try { pw = require('playwright-core'); } catch (e2) {
            console.error('Playwright not found. Run with:');
            console.error('  npx --package=playwright node Code/test-browser-playwright.js');
            process.exit(1);
        }
    }

    // Start HTTP server
    var server = createServer();
    server.listen(PORT);
    console.log('HTTP server on port ' + PORT);

    // Find system Chrome/Chromium
    var launchOpts = { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] };
    var candidates = [
        '/usr/bin/google-chrome-stable', '/usr/bin/google-chrome',
        '/usr/bin/chromium-browser', '/usr/bin/chromium'
    ];
    for (var i = 0; i < candidates.length; i++) {
        if (fs.existsSync(candidates[i])) {
            launchOpts.executablePath = candidates[i];
            console.log('Browser: ' + candidates[i]);
            break;
        }
    }

    var browser = await pw.chromium.launch(launchOpts);
    var page = await (await browser.newContext()).newPage();

    console.log('Loading test page...');
    await page.goto(TEST_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

    console.log('Running all languages...');
    await page.click('#btn-auto');

    // Wait for completion
    await page.waitForFunction(function() {
        var el = document.getElementById('summary');
        if (!el) return false;
        var t = el.textContent;
        return t.includes('passed') && !t.includes('Testing') && !t.includes('Loading');
    }, { timeout: TIMEOUT_MS });

    // Read results from DOM
    var summary = await page.$eval('#summary', function(el) {
        return { text: el.textContent, cls: el.className };
    });

    var failures = await page.$$eval('#log span.fail, #log span.error', function(spans) {
        return spans.map(function(s) { return s.textContent.trim(); });
    });

    // Print
    for (var j = 0; j < failures.length; j++) console.log(failures[j]);
    console.log('\n' + summary.text);

    var passed = summary.cls === 'pass';
    console.log(passed ? 'PASSED' : 'FAILED');

    // Exit immediately — skip browser.close() to avoid playwright-core rimraf bug
    process.exit(passed ? 0 : 1);
}

main().catch(function(err) {
    console.error('Fatal: ' + err.message);
    process.exit(1);
});
