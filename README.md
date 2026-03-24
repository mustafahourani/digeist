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

## Scoring

Every item goes through two stages: (1) a numeric scoring algorithm ranks everything, then (2) Claude Sonnet 4.5 reads the top 30 candidates and picks the final 10 for each column. Each source splits results into **Hottest Today** (last 24 hours) and **Trending This Week** (2-7 days old, still generating buzz).

### GitHub — what's being built

GitHub scores repos across 10 signals to surface what's gaining real traction in the AI space:

| Signal | What it tells us |
|--------|-----------------|
| Star delta | How many stars it gained since yesterday — raw momentum |
| Stars-per-day velocity | Fallback when no delta data is available |
| Freshness | Newer repos score higher — a 1-day-old repo with 50 stars beats a 2-year-old one with 50 |
| Trending page | Bonus if GitHub itself features it on trending |
| Query hit count | Matches multiple search queries = broadly relevant |
| Org reputation | Indie devs get the highest bonus (discovery value). Major orgs (OpenAI, Google) get zero — they surface through HN anyway |
| Fork count | Forks mean people are building on it, not just bookmarking |
| Fork-to-star ratio | A repo with 30 stars and 10 forks is stronger signal than 1000 stars and 2 forks |
| Claude semantic score | Claude rates 1-10 how interesting the repo is for AI practitioners. Highest-weight signal — catches things numbers can't, like a repo called "garden-planner" that's actually an agent orchestration framework |
| Verifiable AI infra | Bonus for repos involving TEE, ZK proofs, or secure enclaves applied to AI (not general crypto) |

GitHub also uses **dynamic query generation**: Claude reads yesterday's digest and generates 3-5 new search queries based on what's trending, making the search adaptive rather than static.

### Hacker News — what's being talked about

HN scores stories across 9 signals. AI relevance is the dominant signal — everything else modifies it:

| Signal | What it tells us |
|--------|-----------------|
| Base score | Raw HN points, log-compressed so a 900-point post doesn't completely drown out a 100-point one |
| AI relevance | 3-tier keyword system. Tier 1 = definitive AI terms (LLM, OpenAI, Claude). Tier 2 = probably AI (agent, MCP, embedding). Tier 3 = weak signals (model, training) only counted if Tier 1/2 also present. **Dominant signal** |
| Velocity | Points per hour — a post with 50 points in 1 hour beats 100 points in 10 hours |
| Discussion heat | Comment-to-score ratio. High comments relative to upvotes = genuine debate, not drive-by likes |
| Show HN bonus | 1.3x boost for Show HN posts — builders showing real work |
| Domain trust | Posts from openai.com, anthropic.com, arxiv.org = 1.2x boost. GitHub, pytorch.org = 1.1x |
| Ecosystem/backing | Bonus for mentions of YC, a16z, Product Hunt, Sequoia, or other notable backers |
| Revenue/funding | Bonus for mentions of ARR, MRR, seed rounds, fundraising milestones |
| Verifiable AI infra | Bonus for TEE, ZK proofs applied to AI (only when AI terms co-occur — filters out pure crypto) |

Data comes from 5 Firebase feeds (top, best, show, new, ask) plus Algolia keyword searches that catch AI stories from the past week that dropped off the live feeds.

### Reddit — what the community is validating

Reddit uses the same base formula as HN (AI relevance as dominant signal, velocity, discussion heat), plus Reddit-specific signals:

| Signal | What it tells us |
|--------|-----------------|
| Subreddit tier | Core subs (r/LocalLLaMA, r/AutoGPT, r/LangChain) = 1.3x — builder communities. Major subs (r/MachineLearning, r/OpenAI) = 1.1x |
| Upvote ratio | >95% agreement = 1.15x boost. Below 70% = 0.8x penalty. Filters controversial or low-quality posts |
| Ecosystem/backing | Bonus for mentions of YC, a16z, Product Hunt, major VCs |
| Revenue/funding | Bonus for mentions of ARR, MRR, seed rounds, fundraising |
| Verifiable AI infra | Bonus for TEE, ZK proofs applied to AI (with AI co-occurrence filter) |
| Body text scanning | Reddit self-posts get their body text checked too — a post describing a funding round in the text (not just the title) still gets caught |

### Claude semantic filter

After numeric scoring, the top 30 candidates from each column are sent to Claude Sonnet 4.5 with source-specific prompts. Claude picks the final 10, ordered by value — catching nuance that numbers miss, like deduplicating coverage of the same event, filtering rage-bait with high scores, or recognizing that a cryptically-named repo is actually a breakthrough agent tool.

The prompts tell Claude to prioritize: major announcements, new tools, viral launches, ecosystem-backed projects, revenue/funding milestones, and verifiable AI infrastructure. If the Claude call fails, the system falls back to pure numeric ordering.

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
