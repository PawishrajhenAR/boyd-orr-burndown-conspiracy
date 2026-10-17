#!/usr/bin/env bash
set -euo pipefail
PARENT="$(cd "$(dirname "$0")/../.." && pwd)"
SRC="$PARENT/SaSProject"
DST="$PARENT/boyd-orr-burndown-conspiracy"
if [[ -d "$DST" ]]; then echo "Already named: $DST"; exit 0; fi
if [[ ! -d "$SRC" ]]; then echo "Source not found: $SRC (cwd may already be renamed)"; exit 1; fi
mv "$SRC" "$DST"
echo "Renamed $SRC -> $DST"
echo "Re-open Cursor on: $DST"
