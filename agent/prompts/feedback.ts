export function buildFeedbackPrompt(date: string): string {
  return `Process feedback for the ${date} daily briefing.

## Your Task

1. Read the current briefing file at agent/Briefings/${date}.md
2. Read any existing feedback for today at agent/Feedback/${date}.json
3. Read current preferences at agent/Preferences.json

Then enter an interactive feedback analysis mode. Look for:

### Edit Detection
Compare the current briefing file against what you originally generated. If the user has edited sections, analyze the changes:
- What was changed and why?
- What preference signal does this give us?
- Does this suggest a pipeline improvement?

### Feedback Processing
For each piece of feedback (from edits or conversation):
1. Identify which section it applies to (tweet_drafts, timing_signals, contrarian_angles, etc.)
2. Extract the preference signal (topic preference, voice correction, quality threshold)
3. Check if it also implies a pipeline improvement (source noise, missing coverage, threshold issue)
4. Record it in the feedback log

### Update Preferences
After processing all feedback:
1. Update topic_weights if the feedback reveals topic preferences
2. Add to voice_learnings if there's a style correction
3. Update source_quality if feedback relates to source signal quality
4. Add to content_preferences if there's a content direction signal
5. Update pipeline_learnings if the feedback implies data quality issues

### Output
Write updated files:
- agent/Feedback/${date}.json — the feedback log for today
- agent/Preferences.json — the updated preferences

Report back with a summary of:
- What feedback was processed
- What preference changes were made
- Any pipeline recommendations that emerged

## Dual Learning Loop

Remember: every piece of feedback improves TWO systems:
1. **Agent improvement** — how you think and write (topic selection, voice, angles, quality)
2. **Digeist pipeline improvement** — what the digest collects and how it ranks (sources, thresholds, keywords)

Both should be reflected in your updates.`;
}
