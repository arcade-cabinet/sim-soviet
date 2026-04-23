#!/usr/bin/env bash
# task-batch-flush.sh — idempotent state flush + progress snapshot.
# Safe to call from PreCompact, SessionStart, or manually.

set -euo pipefail

REPO="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
STATE_DIR="$REPO/.claude/state/task-batch"
PROGRESS_LOG="$STATE_DIR/progress.log"

mkdir -p "$STATE_DIR"

{
  echo "=== $(date -u +%Y-%m-%dT%H:%M:%SZ) FLUSH ==="
  echo "branch: $(git -C "$REPO" branch --show-current 2>/dev/null || echo detached)"
  echo "head:   $(git -C "$REPO" log --oneline -1 HEAD 2>/dev/null || echo unknown)"
  echo ""
  echo "--- open PRs ---"
  gh pr list --state open --limit 30 --json number,title,headRefName,mergeable,mergeStateStatus \
    --jq '.[] | "#\(.number) [\(.mergeable)/\(.mergeStateStatus)] \(.headRefName)"' 2>/dev/null || echo "(gh unavailable)"
  echo ""
  echo "--- batch state ---"
  shopt -s nullglob
  for f in "$STATE_DIR"/batch-*.json; do
    jq -r '"batch=\(.batch_id) status=\(.status // "RUNNING") completed=\(.completed | length) pending=\(.pending | length) failed=\(.failed | length)"' "$f" 2>/dev/null || echo "($f unreadable)"
  done
  shopt -u nullglob
  echo ""
} >> "$PROGRESS_LOG"

date -u +"%Y-%m-%dT%H:%M:%SZ" > "$STATE_DIR/.last-flush"

exit 0
