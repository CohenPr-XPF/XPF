#!/usr/bin/env bash
# Refresh the package's bundled engine from XPF.
#
#   inst/js/translate04.js   <- XPF/Code/translate04-node.js (byte copy)
#   inst/PROVENANCE          <- the commit it came from
#
# The language data is NOT bundled: it is under CC BY-NC-SA 4.0 and users
# fetch it with xpf_download() from the xpfcorpus repository.
#
# Usage: Code/R/tools/sync.sh [--check]
#   --check only compares, and exits non-zero if the copy is out of date.
set -euo pipefail

pkg="$(cd "$(dirname "$0")/.." && pwd)"
xpf="$(cd "$pkg/../.." && pwd)"
src="$xpf/Code/translate04-node.js"
[ -f "$src" ] || { echo "no engine at $src" >&2; exit 1; }

if [ "${1:-}" = "--check" ]; then
    cmp -s "$src" "$pkg/inst/js/translate04.js" && { echo "in sync"; exit 0; }
    echo "STALE: inst/js/translate04.js"; exit 1
fi

cp "$src" "$pkg/inst/js/translate04.js"
rev=$(git -C "$xpf" log -1 --format='%H %cs' 2>/dev/null || echo unknown)
dirty=$([ -n "$(git -C "$xpf" status --porcelain -- Code/translate04-node.js 2>/dev/null)" ] && echo " (uncommitted changes)" || true)
cat > "$pkg/inst/PROVENANCE" <<P
Bundled files and where they came from (written by tools/sync.sh).

js/translate04.js
  XPF Code/translate04-node.js, unmodified
  https://github.com/CohenPr-XPF/XPF
  commit $rev$dirty

The XPF Corpus language data is not bundled; xpf_download() fetches it
(CC BY-NC-SA 4.0) from https://github.com/CohenPr-XPF/xpfcorpus.
P
echo "synced engine"
