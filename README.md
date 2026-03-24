# Digeist

A daily AI industry digest that captures what's actually being talked about, built, and debated across GitHub, Hacker News, and Reddit. Delivered as a clean web dashboard.

**Live:** [digeist.vercel.app](https://digeist.vercel.app)

## What it does

Every day at 5 PM UTC, an automated pipeline:

1. **Fetches** trending repos from GitHub, top stories from Hacker News, and hot posts from 9 AI-focused subreddits
2. **Scores and filters** using composite signals (stars, velocity, engagement, source tier, AI relevance)
3. **Cross-references** sources — if a GitHub repo is also being discussed on HN or Reddit, it gets boosted
4. **Summarizes** HN stories and cleans up Reddit titles using Claude Sonnet
5. **Saves** the digest as a JSON file, commits to GitHub, and Vercel redeploys automatically

The result is a curated daily snapshot of what matters in AI, split into "Hottest Today" and "Trending This Week" for each source.

## Architecture

```
macOS launchd (5 PM UTC daily)
  → scripts/generate-daily.ts
    → lib/pipeline.ts
      ├── lib/sources/github.ts    (GitHub Search API + trending scraper)
      ├── lib/sources/hackernews.ts (Firebase + Algolia APIs)
      ├── lib/sources/reddit.ts    (Reddit JSON API, 9 subreddits)
      ├── Cross-source amplification (1.5x boost for multi-source items)
      └── lib/ai/summarize.ts      (Claude Sonnet for summaries + title cleanup)
    → data/digests/YYYY-MM-DD.json
  → git commit + push → Vercel redeploys
```

There is no database. Digests are flat JSON files stored in `data/digests/` and committed to the repo. The Next.js app reads them from disk at request time.

## Stack

- **Framework:** Next.js 16 (App Router, server components)
- **Styling:** Tailwind CSS 4 + Radix UI
- **AI:** Anthropic Claude Sonnet 4.5 (semantic filtering, scoring, summarization)
- **Data sources:** GitHub Search API, HN Firebase + Algolia, Reddit JSON API
- **Hosting:** Vercel
- **Automation:** macOS launchd (runs the pipeline locally, pushes to GitHub)

## Routes

| Route | Description |
|-------|-------------|
| `/` | Redirects to today's digest |
| `/digest/[date]` | Daily digest for a specific date |
| `/archive` | List of all available digests |
| `/api/cron/generate` | Protected endpoint to trigger digest generation |

## Scoring

Every item goes through a multi-signal composite scoring system before Claude does a final semantic filter. The signals vary by source but follow the same philosophy: combine numeric signals with AI judgment.

### Shared signals (`lib/scoring.ts`)

**AI relevance score (0-1)** — Three-tier keyword matching against the title (and selftext for Reddit):
- **Tier 1** (full weight): Definitive AI terms — `llm`, `openai`, `anthropic`, `claude`, `deepseek`, `chatgpt`, `fine-tun`, `generative ai`, etc.
- **Tier 2** (0.6x): Probably AI — `agent`, `inference`, `embedding`, `vector`, `rag`, `mcp`, `cursor`, `copilot`, `transformer`, etc.
- **Tier 3** (0.3x): Weak signals — `model`, `training`, `dataset`, `parameters`, `api`, `scaling`, etc. Only counted if a Tier 1 or Tier 2 keyword is also present.

Normalized to 0-1 with diminishing returns: `min(1, 0.5 + raw * 0.15)`

**Discussion heat multiplier (1.0-1.5)** — Comment-to-score ratio. A post with 200 comments and 100 upvotes (ratio 2.0) gets a 1.5x multiplier. High discussion relative to score signals genuine community interest, not just drive-by upvotes.

### Tracking criteria signals (`lib/scoring.ts`)

Three binary (0/1) bonus signals that surface posts matching specific tracking criteria. Each returns 0 or 1 and is applied as a small additive bonus — enough to break ties, not enough to override AI relevance.

| Signal | What it matches | Sources | Bonus |
|--------|----------------|---------|-------|
| Ecosystem/backing | YC, a16z, Product Hunt, Sequoia, Techstars, etc. | HN, Reddit | +2 pts |
| Revenue/funding | ARR, MRR, seed rounds, series raises, revenue milestones | HN, Reddit | +2 pts |
| Verifiable AI infra | TEE, ZK proofs, secure enclaves, confidential computing — **only when co-occurring with AI terms** (filters out pure crypto) | GitHub, HN, Reddit | +3 pts |

Virality is not a separate scoring signal — it's already captured by velocity, base score, and discussion heat. The Claude filter prompts explicitly mention virality as a selection criterion.

### GitHub scoring (10 signals)

| Signal | What it measures | Max contribution |
|--------|-----------------|------------------|
| Star delta | Stars gained since last run (log2 compressed) | 10 pts |
| Stars-per-day velocity | Fallback when no delta available | 6 pts |
| Freshness | Repo age: <1 day = 8pts, <3 days = 5pts, <7 days = 3pts, <14 days = 1pt | 8 pts |
| Trending page bonus | Appeared on GitHub trending | 4 pts |
| Query hit count | Matched multiple search queries (breadth of relevance) | 2 pts |
| Org reputation | indie = 3pts (highest discovery value), known = 1pt, major = 0 (they surface via HN anyway) | 3 pts |
| Fork score | Fork count (log2 compressed, capped higher than stars because forks = real usage) | 12 pts |
| Fork-to-star ratio | >30% = 5pts, >15% = 2.5pts — people building on this, not just bookmarking | 5 pts |
| Claude semantic score | Claude rates 1-10 how interesting the repo is for AI practitioners, scaled to 0-15pts. Highest-cap signal because Claude understands context numbers can't. | 15 pts |
| Verifiable AI infra | Repo description/topics mention TEE, ZK, secure enclaves etc. + AI co-occurrence | 3 pts |

After scoring, repos are split into **new** (<24h old) and **trending** (older but gaining traction), then Claude picks the top 10 for each column from the top 30 candidates.

GitHub also uses **dynamic query generation**: Claude reads yesterday's digest and generates 3-5 additional search queries based on what's actually trending, making the search adaptive rather than static.

### Hacker News scoring (9 signals)

Formula: `(baseScore × 3 + aiRelevance × 12 + velocityBonus × 2 + ecosystemBacking × 2 + revenueFunding × 2 + verifiableInfra × 3) × heat × showHnBonus × domainScore`

| Signal | What it measures | Details |
|--------|-----------------|---------|
| Base score | HN points (log2 compressed) | 100pts → 6.6, 400pts → 8.6, 900pts → 9.8 |
| AI relevance | Keyword match score (dominant signal, weight 12) | 0-1 scale from shared scoring |
| Velocity | Points per hour since posting | Capped at 2.0 — rewards fast risers |
| Discussion heat | Comment-to-score ratio multiplier | 1.0-1.5x |
| Show HN bonus | Multiplier for Show HN posts | 1.3x (builders showing real work) |
| Domain trust | Source domain tier | Tier 1 (openai.com, anthropic.com, arxiv.org, etc.) = 1.2x, Tier 2 (github.com, pytorch.org, nvidia.com, etc.) = 1.1x |
| Ecosystem/backing | Mentions YC, a16z, Product Hunt, major VCs | +2 (binary) |
| Revenue/funding | Mentions ARR, MRR, seed rounds, funding, revenue | +2 (binary) |
| Verifiable AI infra | TEE, ZK, secure enclaves + AI co-occurrence | +3 (binary) |

Stories are split into **hot** (<24h) and **rising** (1-7 days, 30+ points minimum), then Claude picks the top 10 for each column.

Data comes from 5 Firebase feeds (top, best, show, new, ask) plus 3 Algolia keyword searches that catch AI stories from the past week that dropped off the live feeds.

### Reddit scoring (10 signals)

Formula: `(baseScore × 3 + aiRelevance × 12 + velocityBonus × 2 + ecosystemBacking × 2 + revenueFunding × 2 + verifiableInfra × 3) × heat × subTier × domainScore × ratioMult`

Same base formula as HN, plus two Reddit-specific signals:

| Signal | What it measures | Details |
|--------|-----------------|---------|
| Subreddit tier | Source quality | Core (AutoGPT, LangChain, LocalLLaMA) = 1.3x, Major (MachineLearning, OpenAI, Anthropic) = 1.1x, General = 1.0x |
| Upvote ratio | Community agreement | >95% = 1.15x, 85-95% = 1.0x, 70-85% = 0.9x, <70% = 0.8x |
| Ecosystem/backing | Mentions YC, a16z, Product Hunt, major VCs | +2 (binary) |
| Revenue/funding | Mentions ARR, MRR, seed rounds, funding, revenue | +2 (binary) |
| Verifiable AI infra | TEE, ZK, secure enclaves + AI co-occurrence | +3 (binary) |

Posts are split into **hot** (<24h) and **rising** (1-7 days, 30+ points minimum), then Claude picks the top 10 for each column.

### Claude semantic filter (all sources)

After numeric scoring, the top 30 candidates from each column are sent to Claude Sonnet with source-specific prompts. Claude picks the final 10, ordered by value. The prompts tell Claude what to keep (major announcements, new tools, Show HN with novel applications, deep technical posts, viral launches, ecosystem-backed projects, revenue/funding milestones, verifiable AI infra) and what to remove (off-topic, duplicates, clickbait, low-effort content).

If the Claude call fails, the system falls back to the numeric score ordering.

### Cross-source amplification

If an HN story or Reddit post links to a GitHub repo that's already in the digest, both items get a 1.5x velocity boost. This surfaces stories that are generating buzz across multiple communities.

## Data format

Each digest is a JSON file at `data/digests/YYYY-MM-DD.json`:

```json
{
  "date": "2026-03-23",
  "generated_at": "2026-03-23T22:00:00.000Z",
  "sources_status": {
    "github": "success",
    "hackernews": "success",
    "reddit": "success"
  },
  "sections": {
    "github": {
      "new_repos": [...],
      "trending_repos": [...]
    },
    "hackernews": {
      "hot_stories": [...],
      "rising_stories": [...]
    },
    "reddit": {
      "hot_posts": [...],
      "rising_posts": [...]
    }
  }
}
```

## Setup

### Prerequisites

- Node.js 18+
- GitHub Personal Access Token (for API rate limits)
- Anthropic API key (for Claude Sonnet)

### Install

```bash
git clone https://github.com/mustafahourani/digeist.git
cd digeist
npm install
cp .env.example .env  # Fill in your API keys
```

### Environment variables

```
GITHUB_TOKEN=your_github_pat
ANTHROPIC_API_KEY=your_anthropic_key
CRON_SECRET=your_cron_secret
```

### Run locally

```bash
npm run dev          # Start the dev server
```

### Generate a digest manually

```bash
npx tsx scripts/generate-daily.ts
```

### Deploy

Push to GitHub. Vercel deploys automatically from the `main` branch.

## Project structure

```
digeist/
├── app/
│   ├── page.tsx                    # Homepage (redirect to today)
│   ├── digest/[date]/page.tsx      # Daily digest view
│   ├── archive/page.tsx            # Archive listing
│   └── api/cron/generate/route.ts  # Protected cron endpoint
├── components/
│   ├── digest/
│   │   ├── digest-page.tsx         # Main digest layout (tabbed: GitHub/HN/Reddit)
│   │   ├── github-item.tsx         # GitHub repo card
│   │   ├── hn-item.tsx             # HN story card
│   │   └── reddit-item.tsx         # Reddit post card
│   └── nav/
│       ├── header.tsx              # Site header + nav
│       └── day-nav.tsx             # Previous/next day navigation
├── lib/
│   ├── pipeline.ts                 # Main pipeline orchestrator
│   ├── storage.ts                  # Read/write digest JSON files
│   ├── types.ts                    # TypeScript interfaces
│   ├── sources/
│   │   ├── github.ts              # GitHub data fetching + scoring
│   │   ├── hackernews.ts          # HN data fetching + scoring
│   │   └── reddit.ts              # Reddit data fetching + scoring
│   └── ai/
│       ├── client.ts              # Anthropic SDK wrapper
│       └── summarize.ts           # HN summarization + Reddit title cleanup
├── config/
│   └── keywords.json              # Search topics + subreddit config
├── data/
│   └── digests/                   # Generated digest JSON files
├── scripts/
│   └── generate-daily.ts          # CLI entry point for pipeline
└── SPEC.md                        # Original design specification
```
