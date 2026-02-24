#!/usr/bin/env python3
"""
Compare translate04.py and translate04-node.js against all language verify files.
Reports any differences in translation output.

Usage:
    python3 Code/test-compare.py [langcode]
"""

import os
import sys
import subprocess
import csv
import re

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(os.path.dirname(SCRIPT_DIR), "Data")
PY = os.path.join(SCRIPT_DIR, "translate04.py")
JS = os.path.join(SCRIPT_DIR, "translate04-node.js")


def find_file_pairs(lang_dir):
    """Find all rules+verify file pairs in a language directory.
    Returns list of (rules_path, verify_path, label) tuples.
    Handles multi-script languages (e.g., tt-cyrillic.rules + tt-cyrillic.verify.csv).
    """
    pairs = []
    for f in sorted(os.listdir(lang_dir)):
        if f.endswith(".rules"):
            base = f[:-len(".rules")]
            verify = os.path.join(lang_dir, f"{base}.verify.csv")
            if os.path.isfile(verify):
                pairs.append((os.path.join(lang_dir, f), verify, base))
    return pairs


def read_verify_words(verify_file):
    """Read words from a verify file."""
    words = []
    with open(verify_file, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "\t" in line:
                word = line.split("\t")[0]
            else:
                word = line.split(",")[0]
            if word:
                words.append(word)
    return words


def translate_py(rules, words):
    """Run Python translator on a list of words."""
    cmd = [sys.executable, PY, "-l", rules] + words
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    if result.returncode != 0:
        return None
    translations = {}
    for line in result.stdout.strip().split("\n"):
        if "\t" in line:
            parts = line.split("\t", 1)
            translations[parts[0]] = parts[1] if len(parts) > 1 else ""
    return translations


def translate_js(rules, words):
    """Run Node.js translator on a list of words."""
    cmd = ["node", JS, "-l", rules] + words
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    if result.returncode != 0:
        return None
    translations = {}
    for line in result.stdout.strip().split("\n"):
        if "\t" in line:
            parts = line.split("\t", 1)
            translations[parts[0]] = parts[1] if len(parts) > 1 else ""
    return translations


def main():
    filter_lang = sys.argv[1] if len(sys.argv) > 1 else None

    # Include both top-level and _compromised languages
    lang_dirs = sorted(os.listdir(DATA_DIR))
    compromised = os.path.join(DATA_DIR, "_compromised")
    if os.path.isdir(compromised):
        for name in sorted(os.listdir(compromised)):
            lang_dirs.append(os.path.join("_compromised", name))

    passed = 0
    failed = 0
    errors = 0
    total = 0
    diff_langs = []

    for langname in lang_dirs:
        lang_dir = os.path.join(DATA_DIR, langname)
        if not os.path.isdir(lang_dir):
            continue
        if filter_lang and not langname.startswith(filter_lang):
            continue

        pairs = find_file_pairs(lang_dir)
        if not pairs:
            continue

        for rules, verify, label in pairs:
            total += 1
            words = read_verify_words(verify)
            if not words:
                passed += 1
                continue

            display = f"{langname}/{label}"

            try:
                py_trans = translate_py(rules, words)
                js_trans = translate_js(rules, words)
            except subprocess.TimeoutExpired:
                print(f"TIMEOUT [{display}]")
                errors += 1
                continue

            if py_trans is None and js_trans is None:
                print(f"ERROR [{display}]: Both failed")
                errors += 1
                continue
            if py_trans is None:
                print(f"ERROR [{display}]: Python failed")
                errors += 1
                continue
            if js_trans is None:
                print(f"ERROR [{display}]: Node.js failed")
                errors += 1
                continue

            # Compare word by word
            diffs = []
            for word in words:
                py_val = py_trans.get(word, "<missing>")
                js_val = js_trans.get(word, "<missing>")
                if py_val != js_val:
                    diffs.append((word, py_val, js_val))

            if diffs:
                failed += 1
                diff_langs.append(display)
                print(f"DIFF [{display}]: {len(diffs)} word(s) differ")
                for word, py_val, js_val in diffs[:5]:
                    print(f"  '{word}': py='{py_val}' js='{js_val}'")
                if len(diffs) > 5:
                    print(f"  ... and {len(diffs) - 5} more")
            else:
                passed += 1

    print()
    print("=" * 40)
    print(f"Results: {passed} passed, {failed} differ, {errors} errors (out of {total} languages)")
    if diff_langs:
        print(f"Differing languages: {', '.join(diff_langs)}")

    return 0 if failed == 0 and errors == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
