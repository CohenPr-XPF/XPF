#!/bin/bash
#
# Copy verify files from Data/ to docs/conv_resources/verify/ so they
# are accessible to the browser-based verification test page.
#
# Also copies rules files that are new or updated.
#
# Usage: bash Code/sync-verify-to-docs.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"
DATA_DIR="$REPO_DIR/Data"
VERIFY_DIR="$REPO_DIR/docs/conv_resources/verify"
RULES_DIR="$REPO_DIR/docs/conv_resources/rules"

mkdir -p "$VERIFY_DIR"

copied=0
skipped=0

# Process both top-level and _compromised languages
for lang_dir in "$DATA_DIR"/*/ "$DATA_DIR"/_compromised/*/; do
    [ -d "$lang_dir" ] || continue

    for verify in "$lang_dir"/*.verify.csv; do
        [ -f "$verify" ] || continue
        base=$(basename "$verify")
        dest="$VERIFY_DIR/$base"

        # Copy if new or source is newer
        if [ ! -f "$dest" ] || [ "$verify" -nt "$dest" ]; then
            cp "$verify" "$dest"
            copied=$((copied + 1))
        else
            skipped=$((skipped + 1))
        fi
    done

    # Also sync rules files
    for rules in "$lang_dir"/*.rules; do
        [ -f "$rules" ] || continue
        base=$(basename "$rules")
        dest="$RULES_DIR/$base"

        if [ ! -f "$dest" ] || [ "$rules" -nt "$dest" ]; then
            cp "$rules" "$dest"
        fi
    done
done

echo "Verify files: $copied copied, $skipped up-to-date"
echo "Destination: $VERIFY_DIR"
