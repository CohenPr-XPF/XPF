#!/bin/bash
#
# Generate test-browser-langs.json for browser-based verification.
# Lists all rules+verify file pairs using paths relative to docs/.
#
# Usage: bash Code/test-browser-gen.sh > Code/test-browser-langs.json

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"
RULES_DIR="$REPO_DIR/docs/conv_resources/rules"
VERIFY_DIR="$REPO_DIR/docs/conv_resources/verify"

echo "["
first=true
for rules in "$RULES_DIR"/*.rules; do
    [ -f "$rules" ] || continue
    base=$(basename "$rules" .rules)
    verify="$VERIFY_DIR/$base.verify.csv"
    [ -f "$verify" ] || continue

    if [ "$first" = true ]; then
        first=false
    else
        echo ","
    fi

    printf '  {"label": "%s", "rules": "conv_resources/rules/%s.rules", "verify": "conv_resources/verify/%s.verify.csv"}' \
        "$base" "$base" "$base"
done
echo ""
echo "]"
