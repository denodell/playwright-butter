#!/usr/bin/env bash
set -uo pipefail
mode="$1"

if [ "$mode" = compare ]; then
  eval "$COMMAND"
  code=$?
  echo "code=$code" >> "$GITHUB_OUTPUT"
  exit 0
fi

eval "$COMMAND --update-snapshots=all"
code=$?
echo "code=$code" >> "$GITHUB_OUTPUT"

count=0
if [ -d "$SNAPSHOT_DIR" ]; then
  while IFS= read -r f; do
    rel="${f#"$SNAPSHOT_DIR"/}"
    mkdir -p "$SMOOTHNESS_BASELINE_DIR/$(dirname "$rel")"
    cp "$f" "$SMOOTHNESS_BASELINE_DIR/$rel"
    count=$((count + 1))
  done < <(find "$SNAPSHOT_DIR" -path '*/smoothness/*' -name '*.json' -type f)
fi
echo "Recorded $count baseline file(s) into $SMOOTHNESS_BASELINE_DIR."
if [ "$count" -gt 0 ] || [ -n "$(find "$SMOOTHNESS_BASELINE_DIR" -type f | head -1)" ]; then
  echo "collected=true" >> "$GITHUB_OUTPUT"
else
  echo "::warning::No baselines were recorded under '$SNAPSHOT_DIR'. Set the snapshot-dir input to where your tests' -snapshots folders are."
  echo "collected=false" >> "$GITHUB_OUTPUT"
fi
exit 0
