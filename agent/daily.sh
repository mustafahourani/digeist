#!/bin/bash
# Daily pipeline: generate digest locally, push to GitHub, agent runs via WatchPaths
# Called by launchd at 5:00 PM UTC (12:00 PM EST)

set -e

cd /Users/mustafa/Projects/Vibecoding/digeist

export PATH="/usr/local/bin:$PATH"

TODAY=$(date -u +%Y-%m-%d)

echo "$(date) — Starting daily pipeline for $TODAY..."

# Step 1: Generate today's digest locally
echo "$(date) — Running digest pipeline..."
npx tsx scripts/generate-daily.ts

# Step 2: Commit and push to GitHub (triggers Vercel deploy)
DIGEST_FILE="data/digests/$TODAY.json"
if [ -f "$DIGEST_FILE" ]; then
  echo "$(date) — Pushing digest to GitHub..."
  git add "$DIGEST_FILE"
  git commit -m "digest: $TODAY" || echo "Nothing to commit"
  git push || echo "Push failed, will retry next run"
else
  echo "$(date) — WARNING: Digest file not found at $DIGEST_FILE"
fi

# Agent briefing runs automatically via WatchPaths when the digest file lands

echo "$(date) — Done."
