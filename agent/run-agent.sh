#!/bin/bash
# Wrapper: runs the agent briefing, then puts Mac to sleep
# Called by launchd via WatchPaths when a new digest lands

set -e

cd /Users/mustafa/Projects/Vibecoding/digeist

export PATH="/usr/local/bin:$PATH"

echo "$(date) — Agent starting..."
npx tsx agent/run.ts
echo "$(date) — Agent finished."

# Sleep only if user is idle (no keyboard/mouse in last 5 min)
IDLE_MS=$(ioreg -c IOHIDSystem | awk '/HIDIdleTime/ {print int($NF/1000000000); exit}')
if [ "$IDLE_MS" -gt 300 ]; then
  echo "$(date) — User idle (${IDLE_MS}s). Sleeping Mac."
  osascript -e 'tell application "System Events" to sleep'
else
  echo "$(date) — User active (${IDLE_MS}s idle). Skipping sleep."
fi
