#!/usr/bin/env bash
# Refresh the package's bundled engine and language data from their sources.
#
#   inst/js/translate04.js   <- XPF/Code/translate04-node.js (byte copy)
#   inst/languages/*.json    <- xpfcorpus/xpfcorpus/data/languages/ (byte copies)
#   inst/PROVENANCE          <- the commits both came from
#
# Usage: Code/R/tools/sync.sh [path/to/xpfcorpus]   (default: sibling of XPF)
# With --check, only compares and exits non-zero if anything is out of date.
set -euo pipefail

pkg="$(cd "$(dirname "$0")/.." && pwd)"
xpf="$(cd "$pkg/../.." && pwd)"
check=0
if [ "${1:-}" = "--check" ]; then check=1; shift; fi
xpfcorpus="${1:-$xpf/../xpfcorpus}"
xpfcorpus="$(cd "$xpfcorpus" && pwd)"
langs="$xpfcorpus/xpfcorpus/data/languages"

[ -f "$xpf/Code/translate04-node.js" ] || { echo "no engine at $xpf/Code" >&2; exit 1; }
[ -d "$langs" ] || { echo "no language data at $langs" >&2; exit 1; }

if [ $check = 1 ]; then
    status=0
    cmp -s "$xpf/Code/translate04-node.js" "$pkg/inst/js/translate04.js" \
        || { echo "STALE: inst/js/translate04.js"; status=1; }
    for f in "$langs"/*.json; do
        cmp -s "$f" "$pkg/inst/languages/lang_$(basename "$f")" \
            || { echo "STALE: $(basename "$f")"; status=1; }
    done
    n_src=$(ls "$langs"/*.json | wc -l); n_pkg=$(ls "$pkg"/inst/languages/lang_*.json | wc -l)
    [ "$n_src" = "$n_pkg" ] || { echo "file count differs: $n_src vs $n_pkg"; status=1; }
    [ $status = 0 ] && echo "in sync"
    exit $status
fi

cp "$xpf/Code/translate04-node.js" "$pkg/inst/js/translate04.js"
rm -f "$pkg"/inst/languages/*.json
# Stored as lang_<code>.json: con.json (Constanza) is a reserved name on
# Windows and R CMD check rejects it.
for f in "$langs"/*.json; do cp "$f" "$pkg/inst/languages/lang_$(basename "$f")"; done

rev() { git -C "$1" log -1 --format='%H %cs' 2>/dev/null || echo unknown; }
dirty() { [ -n "$(git -C "$1" status --porcelain -- "$2" 2>/dev/null)" ] && echo " (uncommitted changes)" || true; }
cat > "$pkg/inst/PROVENANCE" <<P
Bundled files and where they came from (written by tools/sync.sh).

js/translate04.js
  XPF Code/translate04-node.js, unmodified
  https://github.com/CohenPr-XPF/XPF
  commit $(rev "$xpf")$(dirty "$xpf" Code/translate04-node.js)

languages/lang_<code>.json
  xpfcorpus xpfcorpus/data/languages/<code>.json, unmodified
  https://github.com/CohenPr-XPF/xpfcorpus
  commit $(rev "$xpfcorpus")$(dirty "$xpfcorpus" xpfcorpus/data/languages)
P
echo "synced $(ls "$pkg"/inst/languages/*.json | wc -l) language files + engine"
