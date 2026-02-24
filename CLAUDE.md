# Where we are

This is the main directory of the XPF Corpus git repository: https://github.com/CohenPr-XPF/XPF

Directory structure:

- Code/: contains code that the corpus distributed before the xpfcorpus package existed. translate04.py is still the reference
  implementation.

- Data/: language data directories ({langcode}_{LangName}/) each with .rules, .verify.csv, .html, .bib, .Rmd
  - Data/_compromised/: additional 62 language directories with same structure
- docs/: the website for the XPF Corpus
- Guidelines/: ...
- Manual/: the manual of the corpus

The original main directory from which we only copy material here, and never update, is ~/local/xpf/

There is now a new implementation of the corpus in which languages are represented as .json / .yaml files that contain all the
implementation. Locally, this is in ../xpfcorpus. On github it's: https://github.com/CohenPr-XPF/xpfcorpus.

## Goals

* Code/translate04-node.js is supposed to be a clone of translate04.py, we need to verify that it does what we think it does in
  all cases.

* The docs/ javascript implementation is buggy, conflates IO and interface, and should be replaced with something that relies
  directly on Code/translate04-node.js once we're sure that it works + other scripts that would deal with IO. It would be nice
  to add functionality that would let it read files in the up-to-data .json / .yaml format.

* I would like to have completely automated procedure for testing the javascript implementation. Parts of it can be just using
  node or other javascript versions, but I'd also like to add clear scripts to verify online behavior.

## Work Done (2026-02-24)

### 1. VERIFIED: translate04-node.js matches translate04.py (DONE)
- Created `Code/test-compare.py` — runs both Python and Node.js on all verify words, compares output
- Created `Code/test-verify-all.sh` — runs Node.js `-c` verification on all languages
- Results: **203/203 languages pass** (Data/ + Data/_compromised/), **139/139 match** Python output
- Fixed CSV parsing bug in translate04-node.js `parseLine()`: now takes a delimiter param,
  `detectDelimiter()` matches Python's `sniff()` logic (ALL lines must have tabs → TSV, else → CSV).
  This fixed Georgian (comma+tab mixed format), Tamil (quoted TSV), and Tatar Cyrillic.
- Fixed nondeterminism in `Data/nan_MinNanChinese/nan.rules`: two ipasub rules at weight 6 had
  undefined ordering due to Python's `set` hash randomization. Changed `n ˥˧ → ŋ ˥˧` from weight 6 to 7.

### 2. REPLACED: docs/ JS with translate04-node.js + IO bridge (DONE)
- Copied `Code/translate04-node.js` → `docs/js/translate04-node.js`
- Created `docs/js/translate04-io.js` — thin IO bridge (fetchText, loadFromUrl, loadFromString, readFile)
- Updated `docs/Convert-to-IPA.html` to use new engine:
  - `<script src="./js/translate04-node.js">` + `<script src="./js/translate04-io.js">`
  - Uses `translate04io.loadFromUrl(url)` (Promise-based, no constructor race condition)
  - `grammar.translate(word)` returns array, joined with configurable separator
  - Removed stale `parse()`, `AlphabetToIpa(url)` constructor patterns
- Added **phoneme separator dropdown** (none/space/underscore) next to the Translate button
- Removed `docs/Convert-to-IPA-keepspace.html` — the separator dropdown makes it redundant
- Fixed `docs/js/keyboard.js`: replaced old `get()` call with `translate04io.fetchText()`

### 3. AUTOMATED TESTING (DONE)
- Node.js CLI testing:
  - `Code/test-verify-all.sh` — tests all 203 languages via `node translate04-node.js -c`
  - `Code/test-compare.py` — cross-checks Python vs Node.js word-by-word
- Browser testing:
  - `Code/sync-verify-to-docs.sh` — copies verify files to `docs/conv_resources/verify/`
  - `Code/test-browser-gen.sh` — generates `docs/test-browser-langs.json`
  - `docs/test-verify.html` — browser test page (manual + auto via local HTTP server)
  - `Code/test-browser-playwright.js` — **fully automated browser test** using Playwright
    - Starts local HTTP server, opens headless Chrome, runs all 203 languages, reports results
    - Run with: `npx --package=playwright node Code/test-browser-playwright.js`
    - Uses system Chrome/Chromium (auto-detected), no need to install Playwright browsers
    - Result: **203/203 pass**

### 4. NOT YET DONE
- .json/.yaml format support in the docs JS (reading xpfcorpus-format files)
- az_Azerbaijani: k-fronting ipasub rules are commented out in az.rules but verify expects them

## New Files Created

- `Code/test-compare.py` — Python vs Node.js comparison test
- `Code/test-verify-all.sh` — Node.js verification for all languages
- `Code/sync-verify-to-docs.sh` — sync verify files to docs/
- `Code/test-browser-gen.sh` — generate browser test language list
- `Code/test-browser-playwright.js` — Playwright browser automation test
- `docs/js/translate04-node.js` — copy of Code/translate04-node.js for browser
- `docs/js/translate04-io.js` — IO bridge for browser use
- `docs/test-verify.html` — browser verification test page

## Generated Files (gitignored, regenerate with scripts)

- `docs/test-browser-langs.json` — regenerate: `bash Code/test-browser-gen.sh > docs/test-browser-langs.json`
- `docs/conv_resources/verify/*.verify.csv` — regenerate: `bash Code/sync-verify-to-docs.sh`

## Existing Files Modified

- `Code/translate04-node.js` — fixed parseLine() delimiter detection + detectDelimiter()
- `Data/nan_MinNanChinese/nan.rules` — changed ipasub weight from 6 to 7 to fix nondeterminism
- `docs/Convert-to-IPA.html` — updated to use new JS engine + phoneme separator dropdown
- `docs/js/keyboard.js` — replaced old `get()` with `translate04io.fetchText()`

## Files Removed

- `docs/Convert-to-IPA-keepspace.html` — replaced by separator dropdown in Convert-to-IPA.html

## Technical Notes

### Rule types in .rules files
CSV/TSV with columns: type, sfrom, sto, weight, precede, follow, comment
- `pre`: character-level preprocessing (Python str.maketrans equivalent)
- `class`: define regex character classes for use in other rules via {className}
- `match`: simple char→phoneme mapping (no context, fast path)
- `sub`: context-sensitive substitution (precede/follow regex, weight for priority)
- `ipasub`: post-processing on IPA output (applied highest-weight-first, globally)
- `word`: whole-word exception mapping

### Python set nondeterminism
Python's `set` iteration order varies with hash seed (PYTHONHASHSEED). When ipasub rules have
equal weights, their application order becomes nondeterministic. Node.js `Set` preserves insertion
order, making it deterministic. Fix: ensure dependent ipasub rules have distinct weights.

### Three JS implementations (history)
1. `Code/translate04-node.js` — clean UMD port, verified correct (ACTIVE)
2. `docs/js/translate04.js` — OLD browser version, many bugs (kept for reference)
3. `docs/js/translate04-fixipasub.js` — OLD variant, also buggy (no longer used)

Old bugs included: `.split()` vs `.split(" ")`, string-replace pre instead of char-by-char,
broken match rule logic, embedded console.log in translate(), wrong return type.

### Testing commands
```bash
# Node.js verification (all languages)
bash Code/test-verify-all.sh

# Python vs Node.js comparison
python3 Code/test-compare.py

# Browser automation (requires system Chrome/Chromium)
npx --package=playwright node Code/test-browser-playwright.js

# Regenerate browser test data
bash Code/sync-verify-to-docs.sh
bash Code/test-browser-gen.sh > docs/test-browser-langs.json
```
