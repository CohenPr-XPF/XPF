#!/bin/bash
#
# Run translate04-node.js verification (-c flag) against all languages.
# This tests that the Node.js implementation correctly transcribes
# all words in each language's verify file.
#
# Handles multi-script languages (e.g., tt-cyrillic.rules + tt-cyrillic.verify.csv)
# by pairing each .rules file with its matching .verify.csv.
#
# Usage: bash Code/test-verify-all.sh [langcode]

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DATA_DIR="$(dirname "$SCRIPT_DIR")/Data"
JS="$SCRIPT_DIR/translate04-node.js"

PASS=0
FAIL=0
SKIP=0
TOTAL=0
FAIL_LANGS=""

if [ -n "$1" ]; then
    LANG_DIRS=$(ls -d "$DATA_DIR"/${1}* 2>/dev/null)
else
    # Include both top-level and _compromised languages
    LANG_DIRS=$(ls -d "$DATA_DIR"/*/ "$DATA_DIR"/_compromised/*/ 2>/dev/null)
fi

for lang_dir in $LANG_DIRS; do
    lang_dir="${lang_dir%/}"
    langname=$(basename "$lang_dir")

    # Find all .rules files and pair each with its .verify.csv
    for rules in "$lang_dir"/*.rules; do
        [ -f "$rules" ] || continue
        base=$(basename "$rules" .rules)
        verify="$lang_dir/$base.verify.csv"

        if [ ! -f "$verify" ]; then
            SKIP=$((SKIP + 1))
            continue
        fi

        TOTAL=$((TOTAL + 1))
        label="$langname/$base"

        output=$(node "$JS" -l "$rules" -c "$verify" 2>&1)
        exit_code=$?

        if [ $exit_code -eq 0 ]; then
            PASS=$((PASS + 1))
        else
            FAIL=$((FAIL + 1))
            FAIL_LANGS="$FAIL_LANGS $label"
            echo "FAIL [$label]:"
            echo "$output" | head -10
            echo ""
        fi
    done
done

echo "=============================="
echo "Results: $PASS passed, $FAIL failed, $SKIP skipped (out of $TOTAL tested)"
if [ -n "$FAIL_LANGS" ]; then
    echo "Failed languages:$FAIL_LANGS"
fi
