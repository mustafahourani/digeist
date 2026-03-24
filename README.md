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

## How the pipeline works

### Sources

**GitHub** — Searches for repos matching AI topics (`ai-agents`, `llm`, `mcp`, `rag`, etc.) with 50+ stars. Scrapes the GitHub trending page for additional signal. Tracks star/fork deltas using a local cache. Classifies orgs into tiers: major (OpenAI, Anthropic, Google), known (LangChain, Ollama), and indie (highest discovery value).

**Hacker News** — Pulls from 5 Firebase feeds (top, best, show, new, ask) plus Algolia keyword searches for AI topics. Scores using composite signals: base score, AI relevance, velocity, discussion heat, Show HN bonus, and domain trust tier.

**Reddit** — Fetches hot + top/week from 9 subreddits: MachineLearning, LocalLLaMA, OpenAI, Anthropic, artificial, AutoGPT, LangChain, singularity, ChatGPTCoding. Scores with subreddit tier weighting and upvote ratio.

### AI processing

Claude Sonnet is used for:
- **Semantic filtering** — rates candidate items for AI relevance (not just keyword matching)
- **Scoring** — assigns quality scores to GitHub repos based on description, category, and novelty
- **Summarization** — generates one-line summaries for HN stories
- **Title cleanup** — rewrites verbose Reddit titles into clean, scannable text
- **Description enhancement** — rewrites GitHub repo descriptions for clarity

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
