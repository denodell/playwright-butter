#!/usr/bin/env bash
set -uo pipefail
failed=false
for code in "${COMPARE_CODE:-}" "${RECORD_CODE:-}"; do
  [ -n "$code" ] && [ "$code" != 0 ] && failed=true
done
if [ "$failed" = true ]; then
  echo "outcome=failed" >> "$GITHUB_OUTPUT"
  echo "The Playwright run failed."
  exit 1
fi
echo "outcome=passed" >> "$GITHUB_OUTPUT"
