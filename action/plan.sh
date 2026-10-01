#!/usr/bin/env bash
set -euo pipefail

event="${GITHUB_EVENT_NAME:-}"
on_default=false
[ -n "${DEFAULT_BRANCH:-}" ] && [ "${GITHUB_REF:-}" = "refs/heads/$DEFAULT_BRANCH" ] && on_default=true

compare=true
record=false
if [ "$on_default" = true ]; then
  case "$event" in
    push) compare=false; record=true ;;
    schedule | workflow_dispatch) record=true ;;
  esac
fi

baselines="${RUNNER_TEMP:-${TMPDIR:-/tmp}}/smoothness-baselines"
mkdir -p "$baselines"
started="${RUNNER_TEMP:-${TMPDIR:-/tmp}}/smoothness-started"
touch "$started"

results_artifact="${RESULTS_ARTIFACT:-}"
[ -n "$results_artifact" ] || results_artifact="smoothness-results-${GITHUB_JOB:-job}-${GITHUB_RUN_ATTEMPT:-1}-$RANDOM$RANDOM"

{
  echo "compare=$compare"
  echo "record=$record"
  echo "baselines=$baselines"
  echo "started=$started"
  echo "results-artifact=$results_artifact"
} >> "$GITHUB_OUTPUT"

echo "Event: $event on ${GITHUB_REF:-?}. Compare with main: $compare. Record baselines: $record."
