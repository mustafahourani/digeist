# Digeist - Daily AI Industry Trend Radar

## Project Overview

**Project Name:** Digeist
**Goal:** Automated daily digest that captures the true zeitgeist of the AI industry — what's actually being talked about, built, shipped, and debated across Twitter, GitHub, and Hacker News. Delivered as a scrollable web dashboard with weekly rollups.
**Core Insight:** The value isn't just aggregation — it's the right level of focus. Not so broad that it's meaningless ("AI news"), not so narrow that it misses the bigger conversation. The tool captures the themes dominating discourse on any given day, and when a specific project or launch genuinely captures the zeitgeist, it surfaces that too.
**Team Size:** 2-5 people consuming the digest
**Use Case:** Any team in the AI or tech space that wants to stay on the pulse of what the industry is talking about. The AI industry is the core focus. Crypto/Web3 is included as a secondary section specifically for the AI-crypto intersection.

---

## Data Sources

### Primary Sources

| Source | API | What to Capture | Items per Section |
|---|---|---|---|
| **AI Twitter** | X API (pay-per-use) | Trending tweets about AI — models, tools, launches, research, discourse | Top 10 |
| **Crypto/AI Twitter** | X API (pay-per-use) | Trending tweets at the intersection of AI and crypto — agents on-chain, tokenized AI, etc. | Top 10 |
| **GitHub Trending** | GitHub Search API | Repos with most stars gained in last 24 hours, focused on AI/ML | Top 10 |
| **Hacker News** | HN Firebase API | Top upvoted stories from past 24 hours | Top 10 |

### Source Details

#### AI Twitter (Primary)
- **Method:** X API keyword search, ranked by engagement (likes + retweets + quotes)
- **Keywords (initial set, configurable in `config/keywords.json`):**
  - AI models/tools: `LLM`, `GPT`, `Claude`, `Gemini`, `open source AI`, `fine-tuning`, `RAG`, `AI agents`, `MCP`, `model context protocol`
  - AI products: `cursor`, `copilot`, `v0`, `replit agent`, `devin`, `bolt`, `lovable`, `windsurf`
  - AI research: `transformer`, `diffusion`, `multimodal`, `benchmark`, `SOTA`, `reasoning model`
  - Industry: `AGI`, `AI startup`, `foundation model`, `inference`, `training`, `AI funding`
- **Deduplication:** Same tweet fetched multiple times in 24h window only charged once (X API feature)
- **Engagement threshold:** Minimum 300 likes to filter noise

#### Crypto/AI Twitter (Secondary)
- **Method:** X API keyword search, ranked by engagement
- **Scope:** Only the intersection of AI and crypto. This is NOT a general crypto section — it focuses on where AI meets Web3.
- **Keywords (initial set, configurable):**
  - AI x Crypto: `AI agent crypto`, `on-chain agent`, `autonomous agent`, `agent framework`, `ElizaOS`, `ARC`, `Virtuals`
  - Tokenized AI: `AI token`, `GPU DePIN`, `decentralized AI`, `AI DAO`
  - Infrastructure: `AI blockchain`, `agent wallet`, `agent transaction`
- **Engagement threshold:** Minimum 300 likes

#### GitHub Trending
- **Method:** GitHub Search API — query repos with significant star activity in the last 24 hours
- **Query:** `stars:>10 pushed:>{yesterday_date}` filtered by language/topic tags for AI/ML
- **Sorting:** By stars gained (compare current stars vs. snapshot from previous day where possible)
- **Focus:** AI/ML repos are the priority. Web3/crypto repos only if AI-related.
- **Categories:** Group by language and topic (Python ML, TypeScript AI tools, Rust inference)

#### Hacker News
- **Method:** HN Firebase API (`/v0/topstories.json`)
- **Filter:** Top stories by score from the past 24 hours
- **Enrichment:** Fetch each story's details (title, URL, score, comment count), use AI to generate a one-line summary

---

## Digest Structure

### Layout: Source-by-Source Newspaper

The daily digest is a single scrollable page. Each source gets its own section, appearing in this order:

1. **AI Twitter** — clustered themes + individual tweets
2. **Crypto/AI Twitter** — clustered themes + individual tweets
3. **GitHub Trending** — repos grouped by category
4. **Hacker News** — top stories with summaries
5. **Raw Feed** — 10-15 uncategorized items the AI found interesting but didn't fit neatly above

### Section Anatomy

Each source section contains:

```
┌─────────────────────────────────────────────────┐
│ 📡 AI Twitter                    Feb 15, 2026   │
│                                                  │
│ ┌─ "Gemini 3.0 Launch" ─────────────────────┐   │
│ │ Sentiment: 82% positive                    │   │
│ │                                            │   │
│ │ Google released Gemini 3.0 with native     │   │
│ │ agent capabilities. Community response is  │   │
│ │ largely positive, with particular           │   │
│ │ excitement around the 1M token context     │   │
│ │ window.                                    │   │
│ │                                            │   │
│ │ [Embedded Tweet 1]                         │   │
│ │ [Embedded Tweet 2]                         │   │
│ │ [Embedded Tweet 3]                         │   │
│ └────────────────────────────────────────────┘   │
│                                                  │
│ ┌─ "Open Source vs Closed Model Debate" ─────┐   │
│ │ Sentiment: 45% positive                    │   │
│ │ ...                                        │   │
│ └────────────────────────────────────────────┘   │
│                                                  │
│ ── Individual Tweets (not clustered) ──          │
│ [Embedded Tweet]                                 │
│ [Embedded Tweet]                                 │
└─────────────────────────────────────────────────┘
```

### Clustering Logic

Within each Twitter section, the AI:
1. Groups tweets that reference the same theme, event, or discourse into named clusters
2. Writes a neutral analyst summary paragraph for each cluster
3. Selects 2-3 representative tweets to embed below the summary
4. Tweets that don't fit any cluster appear as individual items below
5. Clusters are ordered by total engagement (sum of all tweets in the cluster)

### Item Display

- **Twitter items:** Rendered as embedded tweet previews (oEmbed or similar) showing the full tweet with author, handle, timestamp, and engagement counts
- **GitHub items:** Repo name, description, stars count (and delta if available), primary language, link
- **HN items:** Title, score, comment count, domain, one-line AI summary, link
### Fixed Top 10

Each section shows exactly **10 items**. No overflow, no "show more." The value is in tight curation — if it's not in the top 10, it's not the zeitgeist.

---

## Trend Specificity

The AI should capture the **themes dominating discourse** on a given day. Most days this means focused topic-level clusters — not super broad ("AI news") but not hyper-narrow either. When a specific project or launch genuinely captures the zeitgeist for that day, the AI should surface it as its own cluster.

### Good cluster names:
- "Open Source vs Closed Model Debate" — a theme that dominated AI Twitter for a day
- "Gemini 3.0 Launch" — a specific event that genuinely captured the zeitgeist
- "AI Coding Tools Comparison Wave" — a focused discourse pattern
- "Scaling Laws Skepticism" — a specific intellectual debate trending that day
- "Cursor vs Windsurf Rivalry" — a specific but widely-discussed comparison

### Bad cluster names:
- "AI News" (meaningless)
- "AI Updates" (too broad)
- "Interesting Tweets" (not a theme)
- "Various AI Projects" (lazy grouping)

### The test:
Could someone read this cluster name and immediately understand what conversation was happening that day? If yes, it's good. If it could describe any random day, it's too broad.

---

## Sentiment

### Implementation

Each cluster gets a sentiment analysis based on the tweets/posts within it. Sentiment is expressed as a **percentage** for granularity, not a coarse color bucket.

### Display

A percentage indicator next to the cluster name showing the proportion of positive sentiment:

| Display | Meaning |
|---|---|
| `Sentiment: 92% positive` | Near-unanimous excitement or approval |
| `Sentiment: 65% positive` | Generally positive but notable pushback |
| `Sentiment: 48% positive` | Genuinely split — real debate happening |
| `Sentiment: 20% positive` | Dominated by criticism or skepticism |

Displayed as plain text with a small inline bar visualization. The percentage gives a much more granular read than "positive/mixed/negative" — there's a big difference between 55% and 90% positive.

For non-Twitter sections (GitHub, HN, PH), sentiment is not applicable — skip it.

---

## Weekly Digest

### Overview

Every Sunday at 12:00 PM EST, the pipeline also generates a **weekly rollup** that aggregates the most dominant themes from that week's daily digests.

### What It Contains

- **Top themes of the week:** The 10 most significant clusters/topics across all 7 daily digests, ranked by cumulative engagement
- **Source-by-source highlights:** Top 5 items per source for the week (AI Twitter, Crypto/AI Twitter, GitHub, HN)
- **Trend arcs:** Themes that persisted across multiple days (e.g., "Gemini 3.0 discourse appeared in 4 of 7 daily digests")
- **Week-over-week comparison:** Brief AI-generated summary noting what's new this week vs. last week

### Generation

The weekly digest is generated from the stored daily digest JSON files — it does NOT re-fetch from APIs. It reads the 7 daily JSONs for that week and synthesizes them.

### Storage

```
data/
├── digests/
│   ├── 2026-02-16.json
│   ├── 2026-02-15.json
│   └── ...
├── weekly/
│   ├── 2026-W07.json           # Week 7 of 2026
│   ├── 2026-W06.json
│   └── ...
└── manual/
    └── 2026-02-16.json
```

### Navigation

- Accessible from the dashboard header: "Daily | Weekly" toggle
- Weekly digest page: `/weekly/[year]-W[week]`
- Calendar picker in archive shows both daily and weekly views
- Past weekly digests are stored permanently alongside daily digests

### Weekly JSON Schema

```json
{
  "week": "2026-W07",
  "start_date": "2026-02-09",
  "end_date": "2026-02-15",
  "generated_at": "2026-02-15T17:00:00Z",
  "top_themes": [
    {
      "name": "Gemini 3.0 Launch & Aftermath",
      "summary": "Dominated AI Twitter for 4 of 7 days...",
      "sentiment_avg": 74,
      "days_appeared": 4,
      "total_engagement": 234000,
      "representative_tweets": ["..."]
    }
  ],
  "source_highlights": {
    "ai_twitter": ["top 5 clusters of the week"],
    "crypto_ai_twitter": ["top 5 clusters of the week"],
    "github": ["top 5 repos of the week"],
    "hackernews": ["top 5 stories of the week"]
  },
  "week_over_week": "AI-generated comparison to previous week"
}
```

---

## Dashboard

### Architecture

A Next.js application hosted on Vercel. The pipeline runs as a Vercel Cron Job at 12:00 PM EST daily (and Sundays for weekly). Generated digests are stored as flat JSON files.

### Pages

#### Daily Digest (`/` or `/digest/[date]`)
- Default view: today's digest
- Single scrollable newspaper-style page
- Date displayed prominently at the top
- Navigation arrows: ← Previous Day | Next Day →
- If today's digest hasn't been generated yet, show: "Today's digest will be ready at 12:00 PM EST"

#### Weekly Digest (`/weekly/[year]-W[week]`)
- Same newspaper layout but with weekly aggregated data
- Shows top themes of the week with trend arcs
- Source-by-source highlights (top 5 per source across 4 sources)
- Week-over-week comparison at the top

#### Archive (`/archive`)
- Calendar picker (mini calendar UI)
- Toggle between "Daily" and "Weekly" views
- Click any date to navigate to that day's digest
- Click any week to navigate to that week's rollup
- Dates/weeks with digests are visually marked (dot or highlight)
- Dates without digests are grayed out

#### Manual Add (`/add`)
- Simple form: paste a URL + optional note
- Adds the item to today's digest in the "Raw Feed" section
- Stored alongside the automated items

### Visual Design

- **Theme:** Auto-detect system preference (light/dark mode), support both
- **Layout:** Desktop-only, single column, max-width ~900px centered
- **Typography:** System font stack (sans-serif), monospace for code/repo names
- **Cards:** Each cluster/item in a card with subtle border and shadow
- **Spacing:** Generous whitespace between sections and cards for scannability
- **Section headers:** Large, bold, with a muted icon and date range indicator
- **Embedded tweets:** Use X's oEmbed API or a static rendering approach to show tweet cards within the digest
- **Sentiment bar:** Small inline horizontal bar next to the percentage, filled proportionally

### Responsiveness

Desktop-only. No mobile optimization needed. Minimum supported width: 1024px.

---

## AI Summarization

### Model

Claude API (Sonnet 4.5, model ID: `claude-sonnet-4-5-20250929`) via the **Batch API** for 50% token cost reduction. Sonnet is more than sufficient for clustering, summarization, and sentiment scoring. The Batch API works because the digest runs once daily and doesn't need real-time responses — requests are processed within minutes but billed at half price.

### Tone

**Neutral analyst.** Objective, factual, no opinions or hot takes. The summary describes what happened and why people care, without editorializing.

### Examples

**Good:**
> "Google released Gemini 3.0 with native agent tool-use capabilities and a 1M token context window. The launch drew significant attention, with most discussion focused on benchmark comparisons to Claude and GPT-5. Several developers posted early integration results showing improvements in multi-step reasoning tasks."

**Bad:**
> "Huge day for AI! Google just dropped Gemini 3.0 and it's looking like a game-changer. The AI community is buzzing with excitement..."

### Summarization Tasks

1. **Cluster naming:** Generate a focused, descriptive theme name for each tweet cluster (see Trend Specificity section for guidelines)
2. **Cluster summary:** 2-4 sentence neutral description of what the cluster is about
3. **Sentiment scoring:** Score cluster sentiment as a percentage (0-100% positive)
4. **HN summaries:** One-line summary of each HN story
5. **Cross-source mentions:** Note within a cluster if the same topic appears in multiple sources (e.g., "Also trending on HN with 340 points")
6. **Weekly synthesis:** Generate weekly rollup themes and week-over-week comparison

---

## Data Pipeline

### Flow

```
[Vercel Cron - 12:00 PM EST daily]
  │
  ├── Fetch AI Twitter (X API search)
  ├── Fetch Crypto/AI Twitter (X API search)
  ├── Fetch GitHub Trending (GitHub Search API)
  └── Fetch Hacker News (HN API top stories)
  │
  ▼
[Normalize & Deduplicate]
  │
  ▼
[AI Processing (Claude Sonnet 4.5)]
  ├── Cluster tweets by theme
  ├── Generate cluster names & summaries
  ├── Score sentiment per cluster (percentage)
  ├── Summarize HN stories
  └── Detect cross-source overlap
  │
  ▼
[Store as JSON file]
  │
  ▼
[Dashboard serves the digest]

[Sundays only: also generate weekly rollup from stored daily JSONs]
```

### Parallel Fetching

All 4 data sources are fetched in parallel. Each source has independent error handling.

### Failure Handling

If any source fails (API down, rate limit hit, timeout):
- Generate the digest with whatever sources succeeded
- Display a notice at the top of the affected section: "AI Twitter data unavailable for this digest — API error"
- Log the error for debugging
- Do NOT retry or delay the digest

### Data Storage

Each daily digest is stored as a JSON file:

```
data/
├── digests/
│   ├── 2026-02-16.json
│   ├── 2026-02-15.json
│   └── ...
├── weekly/
│   ├── 2026-W07.json
│   └── ...
└── manual/
    └── 2026-02-16.json  (manual additions for that day)
```

#### Digest JSON Schema

```json
{
  "date": "2026-02-16",
  "generated_at": "2026-02-16T17:00:00Z",
  "sources_status": {
    "ai_twitter": "success",
    "crypto_ai_twitter": "success",
    "github": "success",
    "hackernews": "success",
  },
  "sections": {
    "ai_twitter": {
      "clusters": [
        {
          "name": "Gemini 3.0 Launch",
          "summary": "Google released...",
          "sentiment_pct": 82,
          "total_engagement": 45200,
          "tweets": [
            {
              "id": "1234567890",
              "author_handle": "@googledeepmind",
              "author_name": "Google DeepMind",
              "text": "Introducing Gemini 3.0...",
              "likes": 12000,
              "retweets": 3400,
              "quotes": 890,
              "url": "https://x.com/googledeepmind/status/1234567890",
              "created_at": "2026-02-15T14:30:00Z"
            }
          ],
          "cross_source": ["Also on HN with 540 points"]
        }
      ],
      "unclustered": [
        { "...tweet objects..." }
      ]
    },
    "crypto_ai_twitter": { "...same structure..." },
    "github": {
      "repos": [
        {
          "name": "owner/repo-name",
          "description": "A framework for...",
          "url": "https://github.com/owner/repo-name",
          "stars": 4500,
          "stars_delta": 1200,
          "language": "Python",
          "category": "AI/ML"
        }
      ]
    },
    "hackernews": {
      "stories": [
        {
          "id": 12345,
          "title": "Show HN: ...",
          "url": "https://...",
          "score": 340,
          "comments": 120,
          "summary": "One-line AI summary of the story",
          "hn_url": "https://news.ycombinator.com/item?id=12345"
        }
      ]
    },
  },
  "raw_feed": [
    {
      "source": "ai_twitter",
      "title": "...",
      "url": "...",
      "why": "One-line on why this is interesting"
    }
  ],
  "manual_additions": [
    {
      "url": "https://...",
      "note": "User-provided note",
      "added_by": "manual",
      "added_at": "2026-02-16T18:30:00Z"
    }
  ]
}
```

---

## Configuration

### `config/keywords.json`

Editable keyword lists for each Twitter section. No code changes needed to adjust search terms.

```json
{
  "ai_twitter": {
    "search_queries": [
      "LLM OR GPT OR Claude OR Gemini",
      "AI agents OR MCP OR model context protocol",
      "open source AI OR fine-tuning OR RAG",
      "cursor OR copilot OR replit agent OR devin OR windsurf"
    ],
    "min_likes": 300,
    "max_results_per_query": 50
  },
  "crypto_ai_twitter": {
    "search_queries": [
      "AI agent crypto OR on-chain agent OR autonomous agent",
      "ElizaOS OR ARC OR Virtuals protocol",
      "decentralized AI OR AI token OR GPU DePIN",
      "AI DAO OR agent wallet"
    ],
    "min_likes": 300,
    "max_results_per_query": 50
  },
  "github": {
    "topics": ["machine-learning", "artificial-intelligence", "llm", "deep-learning", "ai-agents", "transformer", "diffusion"],
    "min_stars": 10
  }
}
```

### Environment Variables

```bash
# X API
X_API_BEARER_TOKEN=your_x_api_token

# GitHub
GITHUB_TOKEN=your_github_pat

# Claude API (for summarization)
ANTHROPIC_API_KEY=your_anthropic_key

# App
NEXT_PUBLIC_APP_URL=https://your-digeist-url.vercel.app
CRON_SECRET=your_cron_secret  # Vercel cron auth
```

HN API requires no authentication.

---

## Cost Estimate

### Monthly Costs (Estimated)

| Service | Cost | Notes |
|---|---|---|
| X API (tweets) | ~$45-60/mo | ~200 tweet reads/day + search queries at $0.005/read |
| Claude API (Sonnet 4.5 Batch) | ~$3-8/mo | Sonnet via Batch API (50% off) processing ~50-100 items/day + weekly rollup |
| GitHub API | Free | Authenticated requests, well within rate limits |
| HN API | Free | No auth required |
| Vercel hosting | Free | Free tier, cron jobs included |
| **Total** | **~$48-68/mo** | |

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js (App Router) |
| **Language** | TypeScript |
| **Styling** | Tailwind CSS |
| **Components** | Shadcn UI |
| **Data Storage** | Flat JSON files (in `data/` directory) |
| **AI Model** | Claude Sonnet 4.5 (`claude-sonnet-4-5-20250929`) |
| **Social Data** | X API (pay-per-use) |
| **Hosting** | Vercel (free tier) |
| **Scheduling** | Vercel Cron Jobs |
| **Theme** | System preference (light/dark) |

---

## File Structure

```
digeist/
├── app/
│   ├── page.tsx                    # Redirects to today's digest
│   ├── layout.tsx                  # Root layout with theme provider
│   ├── digest/
│   │   └── [date]/
│   │       └── page.tsx            # Daily digest page
│   ├── weekly/
│   │   └── [week]/
│   │       └── page.tsx            # Weekly rollup page
│   ├── archive/
│   │   └── page.tsx                # Calendar archive page
│   ├── add/
│   │   └── page.tsx                # Manual item addition form
│   └── api/
│       ├── cron/
│       │   ├── generate/
│       │   │   └── route.ts        # Daily cron endpoint
│       │   └── weekly/
│       │       └── route.ts        # Weekly rollup cron endpoint
│       └── manual/
│           └── route.ts            # API for manual item additions
├── components/
│   ├── ui/                         # Shadcn components
│   ├── digest/
│   │   ├── digest-page.tsx         # Main digest layout
│   │   ├── section-header.tsx      # Source section header
│   │   ├── cluster-card.tsx        # Tweet cluster with summary + embeds
│   │   ├── tweet-embed.tsx         # Individual tweet embed renderer
│   │   ├── github-item.tsx         # GitHub repo card
│   │   ├── hn-item.tsx             # HN story card
│   │   ├── raw-feed-item.tsx       # Raw feed item
│   │   ├── sentiment-bar.tsx       # Percentage sentiment indicator
│   │   └── source-error.tsx        # Source failure notice
│   ├── weekly/
│   │   ├── weekly-page.tsx         # Weekly rollup layout
│   │   ├── theme-card.tsx          # Weekly top theme card
│   │   └── trend-arc.tsx           # Multi-day trend indicator
│   ├── archive/
│   │   └── calendar-picker.tsx     # Mini calendar for archive navigation
│   └── nav/
│       ├── day-nav.tsx             # ← Previous Day | Next Day → navigation
│       ├── digest-toggle.tsx       # Daily | Weekly toggle
│       └── header.tsx              # Top bar with nav links
├── lib/
│   ├── sources/
│   │   ├── twitter.ts              # X API client - search + fetch tweets
│   │   ├── github.ts               # GitHub Search API client
│   │   └── hackernews.ts           # HN API client
│   ├── ai/
│   │   ├── summarize.ts            # Claude API - clustering, summaries, sentiment
│   │   ├── weekly.ts               # Claude API - weekly rollup generation
│   │   └── prompts.ts              # System prompts for each AI task
│   ├── storage.ts                  # Read/write digest JSON files
│   ├── pipeline.ts                 # Orchestrates the full daily pipeline
│   ├── weekly-pipeline.ts          # Orchestrates the weekly rollup pipeline
│   └── utils.ts                    # Date helpers, deduplication, etc.
├── config/
│   ├── keywords.json               # Configurable keyword lists per source
│   └── sources.json                # Source-specific settings (thresholds, limits)
├── data/
│   ├── digests/                    # Generated daily digest JSON files
│   ├── weekly/                     # Generated weekly rollup JSON files
│   └── manual/                     # Manual additions JSON files
├── SPEC.md                         # This file
├── .env.example
├── tailwind.config.ts
├── next.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

---

## User Flows

### Morning Digest Consumption
1. Team member opens the Digeist URL at any point after 12 PM EST
2. Sees today's digest with all sections loaded
3. Scrolls through source-by-source: AI Twitter → Crypto/AI Twitter → GitHub → HN → Raw Feed
4. Clicks embedded tweets to open originals on X
5. Done in 5-10 minutes

### Weekly Review
1. Click "Weekly" toggle in the header
2. See this week's rollup (or navigate to a past week)
3. Review top themes of the week with trend arcs showing multi-day persistence
4. Check source-by-source highlights for the week's top items
5. Read the week-over-week comparison

### Checking Past Digests
1. Click "Archive" in the header
2. Toggle between "Daily" and "Weekly" views
3. See a mini calendar with highlighted dates/weeks
4. Click a date or week to view that digest
5. Or use ← / → arrows on any digest page to navigate

### Adding a Manual Item
1. Navigate to `/add`
2. Paste a URL
3. Optionally add a note ("Saw this in a Discord, worth tracking")
4. Submit — item appears in today's Raw Feed section

### Adjusting Keywords
1. Edit `config/keywords.json` in the repo
2. Commit and push
3. Next day's digest uses updated keywords

---

## API Integration Details

### X API (Pay-Per-Use)

**Endpoints used:**
- `GET /2/tweets/search/recent` — search tweets from last 7 days by keyword
- `GET /2/tweets/:id` — fetch individual tweet details (for enrichment)

**Request flow per section:**
1. Execute each search query from `keywords.json` (3-4 queries per section)
2. Request fields: `author_id`, `public_metrics`, `created_at`, `text`, `entities`
3. Expand: `author_id` → user object (name, handle, profile image)
4. Filter to tweets with >= 300 likes
5. Deduplicate across queries (same tweet may match multiple keywords)
6. Sort by total engagement (likes + retweets + quotes)
7. Take top results and pass to Claude for clustering

**Cost controls:**
- Set a spending limit in X Developer Console
- Cap `max_results` per query (50-100)
- X API deduplicates charges for same tweet within 24h UTC window
- The 300-like minimum threshold significantly reduces the volume of tweets to process

### GitHub Search API

**Endpoint:** `GET /search/repositories`

**Query construction:**
```
q=stars:>10 pushed:>{yesterday} topic:{topic}
sort=stars
order=desc
```

Run once per topic from `config/keywords.json`, deduplicate results.

### HN Firebase API

**Endpoints:**
- `GET /v0/topstories.json` — returns array of top story IDs
- `GET /v0/item/{id}.json` — returns story details

Fetch top story IDs, then fetch details for top 50, filter to those posted in last 24 hours, sort by score.

---

## AI Processing Pipeline

### Step 1: Normalize

Convert all source data into a common internal format before AI processing:

```typescript
interface NormalizedItem {
  id: string;
  source: 'ai_twitter' | 'crypto_ai_twitter' | 'github' | 'hackernews';
  title: string;           // tweet text, repo name, story title, product name
  url: string;
  engagement: number;      // likes, stars, score, upvotes (normalized)
  raw_data: any;           // original API response for embedding
  created_at: string;
}
```

### Step 2: Cluster (Twitter sections only)

Send normalized tweets to Claude with this prompt structure:

```
You are analyzing {N} tweets from the past 24 hours about {AI / AI x Crypto}.

Group these tweets into clusters based on the theme, event, or discourse
they reference. Cluster names should capture the specific conversation
happening that day. Most clusters will be focused themes (e.g., "Open
Source vs Closed Model Debate", "AI Coding Tools Comparison Wave"). When
a specific project or launch genuinely dominated the conversation, name
the cluster after it (e.g., "Gemini 3.0 Launch").

Avoid overly broad names like "AI News" or "Various Updates." The cluster
name should make someone immediately understand what conversation was
happening that day.

For each cluster:
1. Name: Focused, descriptive theme name
2. Summary: 2-4 neutral, factual sentences
3. Sentiment: Percentage of positive sentiment (0-100)
4. Representative tweets: Pick 2-3 tweet IDs that best represent this cluster

Tweets that don't fit any cluster should be listed separately.

Return as JSON.
```

### Step 3: Cross-Source Detection

After all sections are processed, check for topic overlap:

```
Given these trending topics across sources:
- AI Twitter clusters: [list]
- Crypto/AI Twitter clusters: [list]
- GitHub repos: [list]
- HN stories: [list]

Identify any topics that appear across multiple sources. Return pairs of
matching items with the sources they appeared in.
```

Matched items get a cross-source annotation in their cluster data.

### Step 4: Generate Raw Feed

From remaining unclustered/lower-ranked items across all sources, pick 10-15 that are still interesting. Claude selects these with a one-line "why" for each.

---

## Scheduling

### Vercel Cron Jobs

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/generate",
      "schedule": "0 17 * * *"
    },
    {
      "path": "/api/cron/weekly",
      "schedule": "0 17 * * 0"
    }
  ]
}
```

- `0 17 * * *` = 5:00 PM UTC = 12:00 PM EST daily (daily digest)
- `0 17 * * 0` = 5:00 PM UTC every Sunday (weekly rollup)

Both cron endpoints are protected with a `CRON_SECRET` environment variable.

### Pipeline Timeout

Vercel serverless functions have a 60-second timeout on the free tier (300s on Pro). The pipeline must complete within this window. If this is too tight:
- Option A: Upgrade to Vercel Pro ($20/mo) for 300s timeout
- Option B: Split the pipeline into multiple chained function calls
- Option C: Use Vercel's Edge Functions or an external scheduler (e.g., Trigger.dev)

---

## Features Explicitly NOT Included (MVP)

- No authentication / user accounts
- No Slack or email notifications
- No Farcaster integration
- No mobile-responsive layout
- No real-time / streaming updates
- No collaborative features (comments, reactions)
- No RSS feed output
- No API for external consumers
- No historical trend tracking ("how did this topic trend over time")
- No automated actions (auto-post to Twitter, auto-create content)
- No custom themes beyond system dark/light
- No analytics on digest usage
- No webhook integrations
- No AI-generated action recommendations ("you should build X")
- No curated account lists (purely keyword-based discovery)
- No company-specific relevance flagging

### Can Be Added Later (V2)
- Company relevance flagging (CONTEXT.md for optional tagging)
- Slack summary notification when digest is ready
- Farcaster as additional source
- Historical trend lines (topic X over last 30 days)
- Team annotations / bookmarks on items
- RSS output for personal feed readers
- Mobile-responsive layout
- Curated "must-follow" account lists per section
- AI-suggested content angles / response strategies
- Email digest option

---

## Success Criteria

### Core Goals
- Daily digest generated reliably at 12 PM EST
- Weekly rollup generated every Sunday
- All 4 sources fetching data correctly
- Clusters capture the right level of specificity (focused themes, not too broad, not too narrow)
- Sentiment percentages are accurate and granular
- Dashboard loads fast and is scannable in under 10 minutes
- Full archive accessible via calendar picker (daily + weekly)
- Monthly cost stays under $70

### Technical Goals
- Pipeline completes within Vercel timeout
- Graceful handling of partial source failures
- Keyword configuration changes take effect next run without code deploy
- Digest JSON schema is stable and well-structured
- Dark and light themes both look polished

---

## Development Phases

### Phase 1: Foundation
1. Initialize Next.js project with TypeScript
2. Set up Tailwind + Shadcn UI
3. Create basic layout (header, navigation, theme toggle)
4. Set up file-based storage (`data/` directory)
5. Create digest page shell with placeholder content

### Phase 2: Data Sources
1. Implement X API client (search + tweet fetch)
2. Implement GitHub Search API client
3. Implement HN API client
4. Create normalized data format
5. Add parallel fetching with independent error handling

### Phase 3: AI Processing
1. Set up Claude API client (Sonnet 4.5)
2. Implement tweet clustering prompt
3. Implement sentiment scoring (percentage-based)
4. Implement cross-source overlap detection
5. Implement HN story summarization
6. Implement raw feed selection

### Phase 4: Pipeline Orchestration
1. Wire up full pipeline: fetch → normalize → AI process → store
2. Create `/api/cron/generate` endpoint
3. Set up Vercel cron job
4. Add source failure handling and status tracking
5. Test end-to-end with real data

### Phase 5: Dashboard UI
1. Build digest page with all section components
2. Implement embedded tweet rendering
3. Build cluster cards with sentiment percentage bars
4. Build GitHub, HN item cards
5. Build raw feed section
6. Add source error notices

### Phase 6: Navigation & Archive
1. Build day navigation (← Previous | Next →)
2. Build archive page with calendar picker (daily + weekly toggle)
3. Implement date-based routing (`/digest/[date]`)
4. Build manual addition form (`/add`)
5. Wire up manual additions to digest display

### Phase 7: Weekly Digest
1. Build weekly rollup pipeline (reads daily JSONs, synthesizes)
2. Create `/api/cron/weekly` endpoint
3. Set up Sunday cron job
4. Build weekly digest page UI
5. Add theme cards with trend arcs
6. Add week-over-week comparison section
7. Wire up weekly navigation in archive

### Phase 8: Polish
1. Dark/light theme with system preference detection
2. Loading states for digest page
3. Empty states (no digest for this date)
4. "Digest generating, check back at 12 PM EST" state
5. Cross-source annotations displayed in clusters
6. Final styling pass

### Phase 9: Deploy
1. Configure environment variables on Vercel
2. Set up Vercel cron jobs (daily + weekly)
3. Create `.env.example` with documentation
4. Configure `keywords.json` with initial keyword sets
5. Deploy and verify first automated run
