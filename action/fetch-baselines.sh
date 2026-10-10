#!/usr/bin/env bash
set -uo pipefail

repo="${GITHUB_REPOSITORY:?}"
case "$DEFAULT_BRANCH" in *[!A-Za-z0-9._/-]*) echo "::warning::Unexpected default branch name; baselines not fetched."; exit 0 ;; esac

id=$(gh api "repos/$repo/actions/artifacts?name=$ARTIFACT_NAME&per_page=100" \
  --jq "[.artifacts[] | select(.expired == false and .workflow_run.head_branch == \"$DEFAULT_BRANCH\")] | sort_by(.created_at) | last | .id // empty" 2>/dev/null)

if [ -z "$id" ]; then
  echo "No '$ARTIFACT_NAME' artifact from $DEFAULT_BRANCH yet, so checks have nothing to compare with. A push to $DEFAULT_BRANCH records them."
  exit 0
fi

zip="${RUNNER_TEMP:-/tmp}/butter-baselines.zip"
if ! gh api "repos/$repo/actions/artifacts/$id/zip" > "$zip"; then
  echo "::warning::Couldn't download main's baselines (artifact $id). Does the job have permissions: actions: read?"
  exit 0
fi
if command -v unzip > /dev/null; then unzip -q -o "$zip" -d "$BASELINES"; else tar -xf "$zip" -C "$BASELINES"; fi
rm -f "$zip"
echo "Fetched main's baselines: $(find "$BASELINES" -type f | wc -l | tr -d ' ') file(s) from artifact $id."
