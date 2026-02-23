export function buildDailyBriefingPrompt(date: string): string {
  return `Generate today's daily briefing for ${date}.

## Your Task

Read today's digest using the read_digest tool for date "${date}". Also read the most recent digests (use list_digests then read the last 3-5 days) for pattern comparison. Load the current preferences and patterns state.

Then produce a complete daily briefing with ALL 7 sections below, written to the file agent/Briefings/${date}.md using the write_file tool.

## Required Sections (all must appear, in this order)

### 1. Executive Summary — "Today's Pulse — [formatted date]"
- 3-5 sentence narrative summary
- Hook first, no AI-speak, concrete specifics
- Reference specific items from the digest by name
- Connect today to recent patterns when relevant
- Never open with "Today's digest shows..." or similar meta-framing

### 2. Tweet Drafts (2-3)
For each tweet:
- Topic name as header
- "Why this is tweet-worthy:" — one sentence
- "Draft:" — the tweet in voice (120-280 chars, hook first, no links in body)
- "Reply link:" — URL for first reply
- Follow ALL Writing Voice rules strictly
- 2-3 drafts maximum. Quality over quantity. If only 1 is truly tweet-worthy, write 1.

### 3. Content Timing Signals
Three urgency levels:
- 🔴 Act now (< 48h window) — with concrete reason why the window is closing
- 🟡 Building (watch this week) — with reason why it's not ready yet
- 🟢 Evergreen opportunity — with reason why there's no deadline
- Max 2-3 items per level. If nothing qualifies for a level, say so honestly.

### 4. Contrarian Angle Detection (1-2)
For each angle:
- "Consensus view:" — what most people are saying
- "The gap:" — what nobody is pointing out
- "Your angle:" — one-sentence framing for different content
- Only genuinely contrarian angles. The gap must be defensible.
- If nothing genuinely contrarian today, say so.

### 5. Article Topics (Pick One) — 2-3 options
For each option:
- Title
- "Angle:" — 2-3 sentences on the angle
- "Type:" — Hot take / Deep analysis / Explainer / Contrarian argument
- "Timeliness:" — Write today / Good for this week / Evergreen
- Distinct angles, not variations of the same thing
- At least one timely, at least one evergreen

### 6. Digeist Pipeline Recommendations
Three possible categories (include only what's warranted):
A. Source Config (keywords.json changes) — with evidence, impact estimate, exact diff
B. Scoring & Filtering (threshold adjustments) — with evidence, impact estimate, exact diff
C. Pipeline Observations (structural suggestions) — only with strong multi-day evidence
- Max 2-3 recommendations total. Every one needs concrete evidence.
- If no changes warranted: "No pipeline changes recommended today."

### 7. Pattern Tracker
- Only patterns with actionable observations
- Use 📈 for accelerating, 📊 for steady, 🆕 for new
- Track in patterns.json across runs (read current state, update, write back)
- Remove patterns stale for 5+ days
- Max 3-5 active patterns
- Each must explain WHY it matters and what to DO about it

## Process

1. Read today's digest
2. Read recent digests for comparison (3-5 days)
3. Read current preferences (agent/Preferences.json)
4. Read current patterns (agent/Patterns.json)
5. Analyze all data
6. Write the complete briefing to agent/Briefings/${date}.md
7. Update patterns.json with any new observations (write to agent/Patterns.json)

Write the briefing as a single markdown file. Be direct, opinionated, and actionable.`;
}
