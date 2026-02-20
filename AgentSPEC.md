# digeist-agent — Proactive Content Strategist

## Overview

**Name:** digeist-agent
**Purpose:** An AI agent that runs daily after Digeist generates its digest, analyzes the data, and produces a rich daily briefing with actionable content output: tweet drafts, article suggestions, timing signals, contrarian angles, pattern observations, and config recommendations.
**Model:** Claude Opus (`claude-opus-4-6`)
**SDK:** Claude Agent SDK (TypeScript)
**Execution:** Local Mac process, triggered 15 minutes after the daily digest cron
**Interface:** VS Code — agent writes markdown files to the project, user reviews and gives feedback via Claude Code in VS Code

---

## Core Design Principles

1. **Draft-only.** The agent never publishes, posts, or modifies anything publicly. It prepares everything for human review. The user acts on the output.
2. **Actionable or silent.** Every section of the briefing must be actionable. If there's nothing good for a contrarian angle today, the section still appears but says so honestly rather than padding with weak content.
3. **Dual learning loop.** Every piece of feedback improves TWO systems: the agent's own taste and output quality, AND the Digeist pipeline itself (what it collects, how it scores, what it filters). Both get better every day.
4. **Content-first.** The agent is a content strategist, not a news aggregator. The digest dashboard already shows what happened. The agent tells you what to DO about it.

---

## Architecture

### Execution Model

```
[Vercel Cron — 5:00 PM UTC]
  → Digeist pipeline generates daily digest JSON
  → Saves to data/digests/YYYY-MM-DD.json

[Local Mac — 5:15 PM UTC (launchd cron)]
  → digeist-agent launches
  → Reads today's digest JSON
  → Reads historical digests for pattern detection
  → Reads preference/feedback history
  → Loads Writing Voice files
  → Generates daily briefing
  → Writes output to data/agent/briefings/YYYY-MM-DD.md
  → Opens in VS Code (or user reviews when ready)
```

### Why Local Mac

- Claude Agent SDK runs agentic loops that can take 1-3 minutes. No serverless timeout constraints.
- Full filesystem access to digest data, Writing Voice folder, and agent state files.
- VS Code integration is native to the local environment.
- No additional infrastructure cost.

### Automation

Use macOS `launchd` to trigger the agent 15 minutes after digest generation:

```xml
<!-- ~/Library/LaunchAgents/com.digeist.agent.plist -->
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.digeist.agent</string>
  <key>ProgramArguments</key>
  <array>
    <string>/path/to/node</string>
    <string>/path/to/digeist/agent/run.ts</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>17</integer>
    <key>Minute</key>
    <integer>15</integer>
  </dict>
  <key>WorkingDirectory</key>
  <string>/Users/mustafa/Desktop/Vibecoding/digeist</string>
</dict>
</plist>
```

The agent can also be run manually at any time:

```bash
npx tsx agent/run.ts                    # Run today's briefing
npx tsx agent/run.ts --date 2026-02-19  # Run for a specific date
npx tsx agent/run.ts --weekly           # Run weekly strategy memo
npx tsx agent/run.ts --article "MCP"    # Write article on a chosen topic
npx tsx agent/run.ts --feedback         # Interactive feedback session
```

---

## Data Access

### What the Agent Reads

| Data | Path | Purpose |
|---|---|---|
| Today's digest | `data/digests/YYYY-MM-DD.json` | Primary input for daily briefing |
| Historical digests | `data/digests/*.json` | Pattern detection across days |
| Weekly digest | `data/weekly/YYYY-WNN.json` | Input for weekly strategy memo |
| Feedback history | `data/agent/feedback/*.json` | Learn from past corrections |
| Preferences | `data/agent/preferences.json` | Accumulated scoring rubric |
| Pattern state | `data/agent/patterns.json` | Running multi-day pattern tracker |
| Writing Voice | `~/Desktop/Writing Voice/*` | Full folder loaded every run |
| Config | `config/keywords.json` | Current tracking configuration |

### What the Agent Writes

| Output | Path | Purpose |
|---|---|---|
| Daily briefing | `data/agent/briefings/YYYY-MM-DD.md` | The main output |
| Article drafts | `data/agent/articles/YYYY-MM-DD-{slug}.md` | Full article + outline |
| Feedback logs | `data/agent/feedback/YYYY-MM-DD.json` | Structured feedback records |
| Preferences | `data/agent/preferences.json` | Updated scoring rubric |
| Pattern state | `data/agent/patterns.json` | Updated pattern observations |
| Weekly memos | `data/agent/weekly/YYYY-WNN.md` | Weekly strategy output |

### What the Agent Does NOT Access

- Raw API data (pre-pipeline). Only final digest JSONs.
- The user's Twitter account. No read or write access.
- The Digeist web dashboard or its rendering layer.
- Any external service beyond web search.

---

## Agent Tools (Claude Agent SDK)

The agent has these tools available via the SDK's tool-use system:

### `read_digest`
Read a digest JSON file by date. Returns the full digest object.
```typescript
{ name: "read_digest", input: { date: "2026-02-20" } }
```

### `list_digests`
List all available digest dates. Returns an array of date strings.
```typescript
{ name: "list_digests", input: { limit?: 30 } }
```

### `read_file`
Read any file from the agent's data directory or the Writing Voice folder.
```typescript
{ name: "read_file", input: { path: "data/agent/preferences.json" } }
```

### `write_file`
Write a file to the agent's output directories.
```typescript
{ name: "write_file", input: { path: "data/agent/briefings/2026-02-20.md", content: "..." } }
```

### `web_search`
Search the web for additional context. Used to enrich research pointers, validate trends, or gather context for article writing.
```typescript
{ name: "web_search", input: { query: "MCP protocol adoption 2026" } }
```

### `read_pdf`
Read a PDF file and extract text content. Used for loading Writing Voice reference PDFs.
```typescript
{ name: "read_pdf", input: { path: "~/Desktop/Writing Voice/First Make Me Care.pdf" } }
```

---

## Daily Briefing Structure

The daily briefing is a single markdown file with these sections, in order. All sections appear every day.

### 1. Executive Summary

3-5 sentences. What mattered today and why. Written as a narrative, not bullet points. This is the "if you read nothing else" section.

**Format:**
```markdown
## Today's Pulse — Feb 20, 2026

[3-5 sentence narrative summary. What happened, why it matters,
and what's different about today vs yesterday.]
```

**Rules:**
- Follows the Writing Voice (hook first, no AI-speak, concrete specifics).
- References specific items from the digest by name.
- Connects today to recent patterns when relevant.
- Never opens with "Today's digest shows..." or similar meta-framing. Just say what happened.

### 2. Tweet Drafts (2-3)

A small number of high-quality tweet drafts for the most tweet-worthy items from the digest. Each draft is written in the user's voice per the Writing Voice folder.

**Format:**
```markdown
## Tweet Drafts

### 1. [Topic — e.g. "New sovereign AI agent build that does..."]

**Why this is tweet-worthy:** [One sentence on why this item deserves a tweet right now.]

**Draft:**
> [The tweet, written in voice. 120-280 characters. Hook first.
> No links in the body — suggest link placement in reply.]

**Reply link:** [URL to include in first reply]

---

### 2. [Topic]
...
```

**Rules:**
- Follow ALL rules from Writing Instructions.md strictly. This is a hard constraint.
- Never use em dashes, "not X but Y" constructions, or banned words.
- Hook in the first line. Write for replies, not likes.
- Never put links in the main tweet body.
- Be specific, not generic. "3 ways..." beats "AI is changing..."
- Vary sentence length. Short and punchy preferred.
- 2-3 drafts maximum. Quality over quantity. If only 1 item is truly tweet-worthy, write 1.

### 3. Content Timing Signals

Tells the user WHEN to act on content opportunities. Based on trend velocity and lifecycle analysis.

**Format:**
```markdown
## Timing Signals

🔴 **Act now (< 48h window):**
- [Topic]: [Why the window is closing. E.g. "Conversation peaked yesterday, you have
  one more day before it's old news."]

🟡 **Building (watch this week):**
- [Topic]: [Why it's not ready yet but worth tracking. E.g. "Third day of growing
  mentions, but no definitive take has emerged yet. Wait for the catalyst."]

🟢 **Evergreen opportunity:**
- [Topic]: [Why this doesn't have a deadline. E.g. "Structural shift in how people
  think about X. You can write about this anytime in the next month."]
```

**Rules:**
- Based on data from the digest and historical patterns.
- Each signal must include a concrete reason, not just "this is trending."
- Maximum 2-3 items per urgency level.
- If nothing qualifies for a level, say "Nothing urgent today" rather than forcing items in.

### 4. Contrarian Angle Detection

Finds the gap in the discourse. What is everyone saying, and what is nobody pointing out?

**Format:**
```markdown
## Contrarian Angles

### [Topic]

**Consensus view:** [What most people/tweets/posts are saying about this.]

**The gap:** [What nobody is pointing out. The overlooked angle, the counter-argument,
the second-order effect, or the thing everyone is getting wrong.]

**Your angle:** [A one-sentence framing of how you could write about this differently.]
```

**Rules:**
- Only include genuinely contrarian angles. Not "here's a different way to say the same thing."
- The gap must be defensible. The agent should be able to explain WHY the consensus is missing something.
- 1-2 contrarian angles per day. If there's nothing genuinely contrarian today, say so.
- This section can be used as fuel for tweets, articles, or threads.

### 5. Article Topics (Pick One)

The agent suggests 2-3 article topics based on today's digest. The user picks one, and the agent writes the full draft in a follow-up interaction.

**Format:**
```markdown
## Article Opportunities

### Option A: [Title]
**Angle:** [2-3 sentences on the angle and why it's worth a longer piece.]
**Type:** [Hot take / Deep analysis / Explainer / Contrarian argument]
**Timeliness:** [Write today / Good for this week / Evergreen]

### Option B: [Title]
...

### Option C: [Title]
...

> Reply with the option letter to generate a full draft + outline.
```

**Rules:**
- Topics should be distinct angles, not variations of the same thing.
- At least one should be timely, at least one should be evergreen.
- The agent should draw from the full day's data, not just the top item.
- Article suggestions can build on contrarian angles or timing signals from above.

### 6. Digeist Pipeline Recommendations

This is the section where the agent improves Digeist itself. Covers the full pipeline: data sources, keywords, scoring thresholds, filtering logic, and anything else that affects what the digest collects and how it ranks items. Recommend only — the agent never modifies config or code directly.

**Three categories of recommendations:**

#### A. Source Config (keywords.json changes)

```markdown
## Digeist Pipeline Recommendations

### Source Config

#### Add: `r/ClaudeAI` to reddit.subreddits

**Evidence:** This subreddit had 3 posts this week that would have scored in
your top 5 Reddit items (based on score and relevance). Titles:
- "Claude 4.5 Opus vs GPT-5 for agent workflows" (score: 340)
- "MCP server implementation patterns" (score: 280)
- "Anthropic's batch API pricing breakdown" (score: 220)

**Impact estimate:** Would add ~2-4 relevant items per digest. Low noise risk
(subreddit is focused and well-moderated).

**Exact change:**
```json
// In config/keywords.json → reddit.subreddits, add:
"ClaudeAI"
```
```

#### B. Scoring & Filtering (threshold adjustments)

```markdown
### Scoring & Filtering

#### Raise Reddit min_score from 20 to 50

**Evidence:** Over the past 7 digests, 34 Reddit items scored between 20-50.
Of those, you only found 3 relevant based on your feedback. That's a 91% noise
rate in that score range.

**Impact estimate:** Would remove ~4-5 low-quality items per digest while
keeping all items you've engaged with positively.

**Exact change:**
```json
// In config/keywords.json → reddit.min_score:
"min_score": 50  // was: 20
```
```

#### C. Pipeline Observations (bigger structural suggestions)

```markdown
### Pipeline Observations

#### The digest is missing Twitter/X data entirely

Your original SPEC.md planned for AI Twitter and Crypto/AI Twitter sections,
but the current pipeline only fetches GitHub, HN, and Reddit. Based on this
week's briefings, 3 of 7 contrarian angles I surfaced came from web search
results that originated on X. Adding X as a source would significantly improve
signal coverage.

**Recommendation:** Revisit the X API integration from the original spec.
The pay-per-use model would cost ~$45-60/mo but would fill a clear gap.
```

**Rules:**
- Every recommendation needs concrete evidence from recent digest data or accumulated feedback.
- Include exact diffs for config changes (copy-paste ready).
- Estimate impact: how many items would this add/remove? What's the noise risk?
- Maximum 2-3 recommendations per day across all three categories.
- If no changes are warranted, say "No pipeline changes recommended today. Digeist is performing well."
- Pipeline Observations (category C) should be rare. Only surface structural suggestions when evidence is strong across multiple days.

### 7. Pattern Tracker

Running observations about multi-day trends. Only surfaces patterns that are actionable.

**Format:**
```markdown
## Patterns

📈 **MCP protocol** — Day 4 of appearing in top-5 GitHub repos. Conversation
shifted from "what is it" to "how to implement it." This is entering the
adoption phase. Content opportunity: implementation guide or comparison piece.

📊 **Open-source inference** — Appeared in 5 of last 7 digests across GitHub
and Reddit. Steady presence, not spiking. Evergreen topic, write when ready.

🆕 **New pattern:** Agent-to-agent communication showed up for the first time
in both HN and GitHub today. Too early to call a trend, but watching.
```

**Rules:**
- Only include patterns with an actionable observation attached.
- "X has appeared for N days" alone is not enough. WHY does it matter? What should the user do?
- Track patterns in `data/agent/patterns.json` across runs.
- Remove patterns that have gone stale (no appearances in 5+ days).
- Maximum 3-5 active patterns at a time.

---

## Article Generation (Two-Step Flow)

### Step 1: Daily briefing suggests 2-3 topics (Section 5 above)

### Step 2: User picks a topic, agent generates

When the user picks an article topic (by telling Claude Code "write Option B" or similar), the agent produces:

**Output file:** `data/agent/articles/YYYY-MM-DD-{slug}.md`

The file contains TWO versions:

#### Version A: Full Article Draft

A complete article written in the user's voice, following all Writing Voice rules strictly. Typically 800-1500 words.

**Structure:**
- Hook opening (per Writing Instructions: "Open with the interesting part. Create curiosity.")
- Body with structured argument (premises → conclusion, evidence for every claim)
- Concrete examples and specifics, not abstractions
- Natural "you" and "I" voice
- Short and long sentences mixed
- No AI-speak (no em dashes, no banned words, no triple structures)

#### Version B: Structural Outline

A detailed outline of the same article, so the user can restructure if the full draft's organization doesn't work.

**Format:**
```markdown
---

## Outline Version

### Hook
[The opening hook in one sentence]

### Section 1: [Title]
- Key point: [...]
- Evidence: [...]
- Transition to next section: [...]

### Section 2: [Title]
...

### Closing
- Takeaway: [...]
- Call to action or question: [...]
```

---

## Writing Voice

### Source Files

The agent loads the entire Writing Voice folder on every run:

| File | Size | Purpose |
|---|---|---|
| `Writing Instructions.md` | 4 KB | Core rules: hooks, argument structure, anti-AI style, tweet format |
| `First Make Me Care.pdf` | 180 KB | Reference on audience engagement and hook writing |
| `Rajczi Primer Methods.pdf` | 4.1 MB | Reference on argumentative structure and reasoning |
| `X Algorithm tips.pdf` | 132 KB | Reference on X/Twitter algorithm mechanics |

**Location:** `~/Desktop/Writing Voice/`

### Voice Rules (Hard Constraints)

These rules from Writing Instructions.md are **non-negotiable**. Every piece of content the agent produces must follow them:

1. Hook first. Never open with background or context.
2. Every claim needs evidence. Structured argument (premises → conclusion).
3. Never corny or cheesy. Never sound like a slogan.
4. NEVER use em dashes (—).
5. NEVER use "not X, but rather Y" or "not just X, but Y."
6. NEVER use banned words: delve, landscape, tapestry, multifaceted, holistic, synergy, leverage (verb), navigate (metaphor), paradigm, robust, streamline, foster, Moreover, Furthermore, In conclusion, It's worth noting that.
7. NEVER open with "In today's world" or "In an era of" or "When it comes to."
8. NEVER use triple-structure rhetorical lists.
9. NEVER start consecutive sentences with the same word.
10. Vary sentence length. Mix short punchy with longer.
11. Concrete examples over abstractions.
12. Write like explaining to a smart friend.
13. Shorter is better. Cut filler.
14. Use "you" and "I" naturally.

**Tweet-specific rules (also non-negotiable):**
1. Hook in first line. Algorithm measures dwell time.
2. Write for replies, not likes. Replies worth 150x a like.
3. Specific beats generic.
4. Never put links in the main tweet.
5. Format for scannability. Line breaks between ideas.
6. Threads: Hook → one idea per tweet → closing question.
7. Keep single tweets tight. Don't fill the character limit.

---

## Feedback & Learning System

### How Feedback Works

All feedback happens inside VS Code. There are two ways to give feedback, and both are always available:

#### Way 1: Chat with Claude Code (conversational)

1. Agent auto-generates daily briefing and writes it to `data/agent/briefings/YYYY-MM-DD.md`.
2. User opens the briefing file in VS Code.
3. User talks to Claude Code about it naturally:
   - "Revise tweet 2, the angle is wrong. It should focus on what this means for indie devs."
   - "The contrarian angle is weak today, can you find a better one?"
   - "Write the article for Option B."
   - "This executive summary buries the lead. The MCP thing is the real story."
4. Claude Code reads the briefing, revises the relevant section, and updates the file.
5. Claude Code also records the feedback pattern to `data/agent/feedback/` and updates `preferences.json`.

#### Way 2: Direct edits in the editor

1. User opens the briefing .md file and edits it directly (rewording a tweet, deleting a section, adding notes).
2. Next time the agent runs, it compares the current file against the original it generated.
3. Any edits are treated as implicit feedback: "the user changed X to Y, which means they prefer Y-style content."
4. The agent logs the diff as feedback and updates preferences accordingly.

#### Both ways work together

You can edit the file directly AND chat about it. The agent learns from both. The key principle: **you never leave VS Code.**

### The Dual Learning Loop

Every piece of feedback flows into TWO improvement streams:

#### Stream 1: Agent Improvement (how the agent thinks and writes)

Feedback like "this tweet misses the point" or "I'd never write about Langchain" improves:
- Topic selection (what the agent considers tweet-worthy or article-worthy)
- Writing style (voice calibration, length preferences, tone)
- Angle selection (contrarian vs consensus, strategic vs tactical)
- Quality threshold (what counts as "good enough" to include)

This is stored in `preferences.json` and loaded into the agent's context every run.

#### Stream 2: Digeist Pipeline Improvement (what the digest collects and how it ranks)

The agent also watches for feedback that implies the **underlying data** is the problem, not just the agent's interpretation. Examples:

| Feedback you give | Agent improvement | Digeist improvement |
|---|---|---|
| "This Reddit post is noise" | Agent learns to deprioritize similar content | Agent recommends raising `min_score` for that subreddit, or dropping it |
| "I keep missing important stuff about MCP" | Agent learns MCP is high priority | Agent recommends adding MCP-related subreddits, GitHub topics, or HN keywords |
| "GitHub section is great, Reddit is useless lately" | Agent weights GitHub insights higher | Agent recommends adjusting Reddit config or adding new subreddits |
| "None of these tweets are interesting today" | Agent recalibrates what "interesting" means | Agent checks if the digest's scoring/filtering is too loose |
| "Why wasn't X in today's digest?" | Agent notes the gap | Agent investigates whether X was filtered out by thresholds or missing keywords, and recommends fixes |

Digeist improvement recommendations appear in the **Digeist Pipeline Recommendations** section of the daily briefing (Section 6). These are always recommend-only. The agent never modifies `config/keywords.json` or pipeline code directly.

### Feedback Storage

**Per-day feedback file:** `data/agent/feedback/YYYY-MM-DD.json`

```json
{
  "date": "2026-02-20",
  "feedback": [
    {
      "section": "tweet_drafts",
      "item": 1,
      "original": "...",
      "feedback": "This misses the real angle. The story isn't about the launch, it's about what it means for open source.",
      "revised": "...",
      "preference_signal": {
        "topic_preference": "prefers strategic implications over news",
        "voice_correction": "more opinionated, less neutral"
      },
      "pipeline_signal": {
        "type": "noise_report",
        "detail": "Reddit item from r/singularity was irrelevant. Speculative AGI timeline content."
      }
    }
  ]
}
```

### Preference Accumulation

**Preferences file:** `data/agent/preferences.json`

This is the agent's evolving scoring rubric. It's append-only — nothing is ever deleted. The agent updates this file after each feedback session.

```json
{
  "last_updated": "2026-02-20",
  "topic_weights": {
    "open_source_ai": 0.9,
    "inference_optimization": 0.8,
    "ai_agents": 0.95,
    "crypto_ai": 0.3,
    "training_research": 0.5
  },
  "voice_learnings": [
    "Prefers opinionated takes over neutral reporting",
    "Likes connecting technical trends to business implications",
    "Wants shorter tweets (under 200 chars) more often than long ones"
  ],
  "source_quality": {
    "github": { "signal_score": 0.85, "notes": "Consistently high quality" },
    "hackernews": { "signal_score": 0.7, "notes": "Good for research, noisy for trends" },
    "reddit": { "signal_score": 0.6, "notes": "r/LocalLLaMA and r/Anthropic best; r/singularity noisy" }
  },
  "content_preferences": [
    "Prefers contrarian angles over consensus summaries",
    "Values implementation details over announcements",
    "Likes 'what does this mean for builders' framing"
  ],
  "pipeline_learnings": {
    "source_noise_log": [
      { "source": "reddit", "subreddit": "singularity", "noise_count": 10, "signal_count": 2, "recommendation": "remove" },
      { "source": "reddit", "subreddit": "ClaudeAI", "missed_items": 3, "recommendation": "add" }
    ],
    "threshold_observations": [
      "Reddit min_score of 20 lets through too much noise. 34 items in the 20-50 range over 7 days, only 3 relevant.",
      "GitHub min_stars of 50 is well-calibrated. No complaints."
    ],
    "missing_coverage": [
      "User asked about MCP content that wasn't in the digest twice this week. Current GitHub topics include 'mcp' but Reddit and HN have no MCP-specific filtering.",
      "No X/Twitter source active. Original spec planned for it. Multiple briefing insights came from web search results originating on X."
    ]
  },
  "feedback_history_count": 47
}
```

**Learning approach: Structured scoring rubric that evolves.**

The agent maintains explicit, auditable preference weights and learnings. After each feedback session, it reviews the feedback and decides whether to update the rubric. This is transparent (the user can read the preferences file) and adaptive (it changes based on real feedback). The agent includes the current rubric in its context on every run to guide its analysis and content generation.

The `pipeline_learnings` section accumulates evidence about Digeist's data quality over time. When enough evidence builds up (e.g., a subreddit has been noisy for a week straight), the agent surfaces it as a recommendation in Section 6 of the daily briefing. This means the recommendations are backed by accumulated data, not just a single day's impression.

---

## Pattern Tracking

### State File

**Path:** `data/agent/patterns.json`

```json
{
  "active_patterns": [
    {
      "topic": "MCP protocol",
      "first_seen": "2026-02-17",
      "last_seen": "2026-02-20",
      "days_appeared": 4,
      "sources": ["github", "hackernews", "reddit"],
      "trajectory": "accelerating",
      "observation": "Shifted from 'what is it' to 'how to implement it'",
      "actionable": true,
      "suggested_action": "Implementation guide or comparison piece"
    }
  ],
  "expired_patterns": [
    {
      "topic": "Gemini 3.0 Launch",
      "first_seen": "2026-02-10",
      "last_seen": "2026-02-13",
      "days_appeared": 4,
      "expired_reason": "No appearances in 5+ days"
    }
  ]
}
```

### Rules

- A pattern requires 2+ consecutive days of appearance to be tracked.
- Patterns expire after 5 days of no appearance.
- Maximum 5 active patterns at a time. If a new one emerges, the weakest one gets bumped.
- Each pattern must have an `actionable` flag and `suggested_action`.
- The Pattern Tracker section in the daily briefing only shows patterns where `actionable: true`.

---

## Weekly Strategy Memo

### Trigger

Runs on Sundays automatically (same launchd cron). Can also be triggered by telling Claude Code "run the weekly memo."

### Input

The weekly memo synthesizes THREE sources:
1. The Digeist weekly digest JSON (`data/weekly/YYYY-WNN.json`)
2. The agent's own 7 daily briefings from that week (`data/agent/briefings/*.md`)
3. All user feedback from that week (`data/agent/feedback/*.json`)

### Output

**Path:** `data/agent/weekly/YYYY-WNN.md`

### Structure

```markdown
# Weekly Strategy Memo — Week of Feb 17-23, 2026

## This Week in One Paragraph
[Narrative summary of the week's biggest themes and shifts.]

## Top Content Opportunities This Week
1. [Topic] — [Why it's the best content opportunity and suggested format]
2. [Topic] — ...
3. [Topic] — ...

## What I Got Right This Week
[Agent self-assessment: which recommendations landed well, which tweet drafts
the user approved, which patterns proved correct.]

## What I Got Wrong This Week
[Agent self-assessment: which recommendations missed, what feedback patterns
suggest miscalibration.]

## Preference Drift
[Has the user's taste shifted this week? Any new patterns in feedback?
E.g. "You've been preferring shorter, more opinionated tweets this week
vs last week's preference for analytical takes."]

## Config Health
[Overall assessment of keywords.json effectiveness. Are the sources
delivering good signal? Any structural recommendations?]

## Next Week Preview
[Based on patterns and trajectories, what should the user watch for
next week? Any predictions on emerging topics?]
```

---

## File Structure

```
digeist/
├── agent/
│   ├── run.ts                        # Entry point — CLI runner
│   ├── agent.ts                      # Core agent setup (Claude SDK)
│   ├── tools/
│   │   ├── read-digest.ts            # Tool: read digest JSON by date
│   │   ├── list-digests.ts           # Tool: list available digest dates
│   │   ├── read-file.ts              # Tool: read agent data files
│   │   ├── write-file.ts             # Tool: write output files
│   │   ├── web-search.ts             # Tool: web search for enrichment
│   │   └── read-pdf.ts              # Tool: read PDF files
│   ├── prompts/
│   │   ├── system.ts                 # System prompt with voice rules
│   │   ├── daily-briefing.ts         # Prompt for daily briefing generation
│   │   ├── article.ts                # Prompt for article writing
│   │   ├── feedback.ts               # Prompt for feedback processing
│   │   └── weekly.ts                 # Prompt for weekly strategy memo
│   └── lib/
│       ├── preferences.ts            # Read/write preferences.json
│       ├── patterns.ts               # Read/write patterns.json
│       └── voice-loader.ts           # Load Writing Voice folder
├── data/
│   ├── digests/                      # [existing] Daily digest JSONs
│   ├── weekly/                       # [existing] Weekly digest JSONs
│   └── agent/
│       ├── briefings/                # Daily briefing markdown files
│       ├── articles/                 # Article draft markdown files
│       ├── feedback/                 # Per-day feedback JSON logs
│       ├── weekly/                   # Weekly strategy memo files
│       ├── preferences.json          # Accumulated scoring rubric
│       └── patterns.json             # Active pattern tracker
├── config/
│   └── keywords.json                 # [existing] Source configuration
└── ...
```

---

## Agent System Prompt

The agent's system prompt is assembled dynamically on each run from these components:

```
1. Base identity and role description
2. Full Writing Voice rules (from Writing Instructions.md)
3. Writing Voice PDF content (loaded fresh each run)
4. Current preferences.json content
5. Current patterns.json content
6. Today's date and context
7. Instructions for the specific task (daily briefing / article / feedback / weekly)
```

### Base Identity

```
You are digeist-agent, a proactive content strategist for Mustafa. You analyze
daily AI industry digests and produce actionable content output.

Your job is NOT to summarize what happened. The digest dashboard already does that.
Your job is to tell Mustafa what to DO about it: what to write, when to write it,
what angle to take, and what everyone else is missing.

You are opinionated. You have taste. You make recommendations, not suggestions.
When you're confident something is tweet-worthy, say so directly. When something
is noise, say that too.

You write all content in Mustafa's voice. The voice rules below are non-negotiable.
```

---

## VS Code Interaction Model

### Daily Flow (No Terminal Commands Needed)

1. **Briefing auto-generates** at 5:15 PM UTC via launchd. A new file appears: `data/agent/briefings/2026-02-20.md`
2. **You open it in VS Code** whenever you're ready (that day, next morning, whenever).
3. **You review and interact** using any combination of:
   - Reading the file directly in the editor
   - Editing the file (rewriting tweets, adding notes, deleting sections)
   - Chatting with Claude Code ("revise tweet 2", "write Option B article", "the summary misses the point")
4. **The agent learns** from both your edits and your chat feedback.

### Example Interactions via Claude Code

| What you say | What happens |
|---|---|
| "Revise tweet 2, make it shorter and more opinionated" | Agent rewrites tweet 2 in the briefing file and notes the preference |
| "Write the article for Option B" | Agent generates full article + outline at `data/agent/articles/` |
| "The contrarian angle is weak, find a better one" | Agent re-analyzes the digest and writes a new contrarian section |
| "Run the weekly memo" | Agent generates this week's strategy memo |
| "What are my current preferences?" | Agent reads and summarizes `preferences.json` |
| "Stop suggesting Langchain content" | Agent updates preferences immediately |
| "Generate a briefing for yesterday" | Agent runs the briefing pipeline for the specified date |

### Direct Edit Detection

When the agent runs its next daily briefing, it checks whether you edited the previous day's file:

```
Original (agent wrote):  "Claude 4.5 just dropped and inference costs are falling fast."
Your edit:               "Anthropic shipped Claude 4.5. Inference costs dropped 60% in 6 months."

Agent learns:            "Prefers specific numbers over vague claims. Prefers company name
                          over product name as the subject. Shorter sentences."
```

These edit-derived learnings get appended to `preferences.json` alongside chat-based feedback.

---

## Cost Estimate

| Component | Cost | Notes |
|---|---|---|
| Claude Opus API (daily briefing) | ~$0.50-1.50/run | ~10K input tokens (digest + voice + prefs), ~3K output |
| Claude Opus API (article) | ~$0.50-1.00/run | Only when requested |
| Claude Opus API (feedback) | ~$0.30-0.80/session | Varies by feedback volume |
| Claude Opus API (weekly) | ~$1.00-2.00/run | Larger context (7 days of data) |
| Web search | ~$0.01/search | Minimal usage |
| **Daily total** | **~$1-3/day** | ~$30-90/month |
| **With articles + feedback** | **~$2-5/day** | ~$60-150/month |

---

## Development Phases

### Phase 1: Foundation
1. Set up `agent/` directory structure
2. Implement Claude Agent SDK client with Opus model
3. Build tool definitions (read_digest, list_digests, read_file, write_file, web_search, read_pdf)
4. Implement voice loader (reads full Writing Voice folder including PDFs)
5. Build the agent runner script that launchd will call

### Phase 2: Daily Briefing
1. Write system prompt assembly logic
2. Implement daily briefing generation (all 7 sections)
3. Test with real digest data
4. Iterate on prompt quality until output matches voice rules
5. Add preferences.json loading into context

### Phase 3: Feedback Loop
1. Implement edit detection (diff previous briefing against current version to detect user changes)
2. Implement preference extraction (agent identifies and records patterns from edits and chat feedback)
3. Build preferences.json read/write logic
4. Ensure Claude Code can trigger revisions on the briefing file naturally
5. Test feedback → preference → improved next run loop

### Phase 4: Pattern Tracking
1. Implement patterns.json state management
2. Build cross-day analysis (compare today's digest to recent history)
3. Implement pattern lifecycle (creation → tracking → expiry)
4. Integrate pattern observations into daily briefing Section 7
5. Test with a week of historical digest data

### Phase 5: Article Generation
1. Build article prompt with full Writing Voice loading
2. Implement two-version output (full draft + structural outline)
3. Test article quality against voice rules
4. Wire up "write Option B" flow through Claude Code chat

### Phase 6: Weekly Strategy Memo
1. Build weekly prompt that synthesizes digest + briefings + feedback
2. Implement self-assessment logic (what the agent got right/wrong)
3. Build preference drift detection
4. Test with accumulated data

### Phase 7: Automation & Polish
1. Set up launchd cron for daily execution (briefing auto-generates at 5:15 PM UTC)
2. Add error handling and retry logic
3. Final prompt tuning across all modes
4. Test the full daily loop: auto-generate → user reviews in VS Code → edits/chat → agent learns

---

## Success Criteria

### Daily Briefing Quality
- Executive summary captures the actual important thing, not just the loudest thing.
- Tweet drafts pass a "would Mustafa actually post this?" test.
- Timing signals are backed by data, not vibes.
- Contrarian angles are genuinely contrarian, not restatements.
- Config recommendations include evidence and are actionable.
- All content follows Writing Voice rules with zero violations.

### Learning Effectiveness
- After 2 weeks of feedback, the agent's recommendations noticeably improve.
- Preferences file accurately reflects the user's actual taste.
- Pattern tracker catches trends before they're obvious.
- Config recommendations lead to measurable signal quality improvement.

### Operational
- Daily briefing generates reliably within 3 minutes.
- All output files are written correctly and readable in VS Code.
- Feedback sessions feel conversational, not tedious.
- Monthly API cost stays under $150.
- Agent handles missing/partial digest data gracefully.
