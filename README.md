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

Every item goes through two stages before it appears in the digest:

1. **Numeric scoring** — an algorithm in `lib/scoring.ts` and each source file (`lib/sources/github.ts`, `hackernews.ts`, `reddit.ts`) scores every item using multiple weighted signals. The scores determine which items make it into the top 30 candidate pool per column.
2. **Claude semantic filter** — Claude Sonnet 4.5 reads those 30 candidates (with titles, scores, comments, age, and domain) and picks the final 10 that appear in the digest, ordered by importance.

Each source splits results into two columns: **Hottest Today** (last 24 hours) and **Trending This Week** (2-7 days old, still generating buzz).

### Keyword lists used across all sources

The following keyword lists are defined in `lib/scoring.ts` and used by GitHub, Hacker News, and Reddit scoring. They power the AI relevance signal (the dominant scoring signal across all sources) and the three tracking criteria signals.

**AI relevance keywords** — a 3-tier system that determines how AI-related a post/repo is:

- **Tier 1 — definitely AI** (full weight): `llm`, `large language model`, `openai`, `anthropic`, `claude`, `deepseek`, `deepmind`, `chatgpt`, `gpt-3/4/5`, `o1/o3`, `sonnet`, `opus`, `haiku`, `gemini`, `grok`, `rlhf`, `agi`, `language model`, `foundation model`, `diffusion model`, `transformer model`, `neural network`, `deep learning`, `machine learning`, `fine-tuning`, `generative ai`, `multimodal`, `hugging face`, `mistral`, `meta ai`, `llama`, `qwen`, `phi`, `stable diffusion`
- **Tier 2 — probably AI** (0.6× weight): `ai`, `agent`, `inference`, `embedding`, `vector`, `rag`, `gpu`, `nvidia`, `cuda`, `tpu`, `benchmark`, `reasoning`, `alignment`, `safety`, `context window`, `token`, `prompt`, `mcp`, `model context protocol`, `cursor`, `windsurf`, `devin`, `replit`, `v0`, `bolt`, `coding agent`, `vibe coding`, `agentic`, `perplexity`, `groq`, `copilot`, `transformer`, `reinforcement learning`
- **Tier 3 — weak signal** (0.3× weight, only counted if a Tier 1 or 2 keyword is also present): `model`, `training`, `dataset`, `parameters`, `weights`, `latency`, `throughput`, `api`, `scaling`, `open source`, `python`, `tensor`, `compute`, `cloud`, `quantization`, `optimization`, `distillation`

Each keyword match is counted and weighted by tier, then normalized to 0-1: `min(1, 0.5 + raw × 0.15)`. A title with one Tier 1 match scores 0.65. Two Tier 1 + one Tier 2 scores 0.89. Diminishing returns prevent keyword-stuffed titles from gaming the score.

**Ecosystem/backing keywords** (used by HN and Reddit): `product hunt`, `y combinator`, `YC`, `a16z`, `andreessen horowitz`, `sequoia`, `greylock`, `benchmark`, `lightspeed`, `khosla`, `founders fund`, `techstars`, `backed by`

**Revenue/funding keywords** (used by HN and Reddit): `MRR`, `ARR`, `revenue`, `paying customers`, `seed round`, `pre-seed`, `Series A/B/C`, `angel round`, `funding`, `valuation`, `profitable`, `break even`, `raised $` (requires dollar sign), `$X M/B/K` (dollar amounts)

**Verifiable AI infra keywords** (used by GitHub, HN, and Reddit): `TEE`, `trusted execution`, `SGX`, `secure enclave`, `confidential computing`, `verifiable compute`, `zero knowledge`, `ZK proof`, `zkML`, `ZKML`, `homomorphic`, `FHE`, `proof of inference`, `attestation`, `on-chain inference` — **must co-occur with a Tier 1 or Tier 2 AI keyword**, otherwise returns 0 (filters out pure crypto/blockchain content)

### GitHub — what's being built

**Source:** `lib/sources/github.ts` scrapes 4 GitHub trending pages (all languages, Python, TypeScript, Rust), runs 34 GitHub API search queries (9 topic-based, 17 keyword-based, 5 dynamically generated by Claude from yesterday's trends, 2 for new repos, 1 for rising repos), deduplicates everything, and scores each repo. Minimum 50 stars to be considered (configured in `config/keywords.json`).

**Scoring formula** — all 10 signals are added together for a max of ~68 points:

| Signal | In plain English | How it's calculated | Max pts |
|--------|-----------------|-------------------|---------|
| Star delta | How fast is this blowing up right now? | `log2(stars gained since last run) × 1.5` — 100 new stars = 6.6pts, 500 = 9.0pts | 10 |
| Stars-per-day velocity | How fast did it grow overall? (backup metric) | `log2(total stars / age in days) × 2` — only used when no delta data exists | 6 |
| Freshness | How new is this project? | Repo age: <1 day = 8pts, <3 days = 5pts, <7 days = 3pts, <14 days = 1pt, older = 0 | 8 |
| Trending page bonus | Is GitHub itself featuring this? | 4pts if on any of GitHub's 4 trending pages, 0 otherwise | 4 |
| Query hit count | Does it match lots of AI-related searches? | Each additional query match beyond the first adds 0.5pts | 2 |
| Org reputation | Is this from an unknown builder worth discovering? | Indie devs = 3pts, known orgs (LangChain, Ollama) = 1pt, big corps (OpenAI, Google) = 0pts | 3 |
| Fork count | Are people actually building on top of this? | `log2(forks) × 2.5` — forks mean real usage, not just bookmarking | 12 |
| Fork-to-star ratio | Are people using it or just starring it? | >30% forks-to-stars = 5pts, >15% = 2.5pts | 5 |
| Claude semantic score | Is this actually interesting for AI practitioners? | Claude rates 1-10, scaled to 0-15pts. **Highest-weight signal** — catches context numbers miss. Note: this is a *scoring* step that feeds into the ranking formula, separate from the Claude *filter* step later that picks the final 10 from the top 30. GitHub is the only source where Claude scores individual items before filtering. | 15 |
| Verifiable AI infra | Is this about provably secure AI? | 3pts if mentions TEE/ZK/secure enclaves **and** AI terms. Pure crypto = 0 | 3 |

**Column split:** Repos created <24 hours ago go into "Hottest Today." Repos 1-7 days old with traction signals (star/fork deltas or 100+ stars) go into "Trending This Week." Major org repos only make "Trending" if Claude rated them ≥7/10. Each column's top 30 by score go to Claude, which selects the final 10.

**Dynamic query generation:** Claude reads yesterday's GitHub and HN results and generates 3-5 new search queries targeting trends the static keywords might miss (e.g. `"Claude Code skill" OR "agent kernel" OR "CTF solver autonomous"`). This makes the search adaptive day-to-day.

### Hacker News — what's being talked about

**Source:** `lib/sources/hackernews.ts` fetches 5 Firebase feeds (top, best, show, new, ask stories) plus 3 Algolia keyword searches (`"LLM OR OpenAI OR Anthropic"`, `"AI agent OR MCP"`, `"GPT OR Gemini OR DeepSeek"`) that catch AI stories from the past 7 days that dropped off the live feeds. All results are merged and deduplicated.

**Scoring formula:** `(baseScore × 3 + aiRelevance × 12 + velocity × 2 + ecosystemBacking × 2 + revenueFunding × 2 + verifiableInfra × 3) × heat × showHnBonus × domainTrust`

| Signal | In plain English | How it's calculated | Weight/Range |
|--------|-----------------|-------------------|-------------|
| Base score | How popular is this post? | `log2(HN points)` — 100pts = 6.6, 400pts = 8.6, 900pts = 9.8. Compresses so mega-posts don't drown everything | ×3 in formula |
| AI relevance | How AI-related is this? | 3-tier keyword match (see full keyword lists below). Normalized to 0-1 with diminishing returns. **Dominant signal** | ×12 in formula (0-1 scale) |
| Velocity | How fast is this gaining attention? | `points per hour / 50`, capped at 2.0 — 50pts in 1 hour beats 100pts in 10 hours | ×2 in formula |
| Ecosystem/backing | Is a notable backer involved? | 1 if title mentions YC, a16z, Product Hunt, Sequoia, Techstars, etc. 0 otherwise | ×2 in formula |
| Revenue/funding | Is there a money milestone? | 1 if title mentions ARR, MRR, revenue, seed round, Series A/B/C, raised $X, etc. 0 otherwise | ×2 in formula |
| Verifiable AI infra | Is this about provably secure AI? | 1 if mentions TEE, ZK proofs, secure enclaves **and** AI terms. 0 otherwise. Filters out pure crypto | ×3 in formula |
| Discussion heat | Are people actually debating this? | Comment-to-score ratio → 1.0-1.5× multiplier. 200 comments on 100 upvotes = 1.5× | 1.0-1.5× multiplier |
| Show HN bonus | Is someone showing real work they built? | 1.3× for Show HN posts, 1.0× for everything else | 1.0-1.3× multiplier |
| Domain trust | Is this from a reputable source? | Tier 1 (openai.com, arxiv.org, anthropic.com) = 1.2×. Tier 2 (github.com, pytorch.org) = 1.1×. Other = 1.0× | 1.0-1.2× multiplier |

**Column split:** Stories <24 hours old go into "Hottest Today." Stories 1-7 days old with ≥30 HN points go into "Trending This Week." Each column's top 30 go to Claude for final selection of 10.

### Reddit — what the community is validating

**Source:** `lib/sources/reddit.ts` fetches hot and top/week posts from 9 subreddits (configured in `config/keywords.json`): r/MachineLearning, r/LocalLLaMA, r/OpenAI, r/Anthropic, r/artificial, r/AutoGPT, r/LangChain, r/singularity, r/ChatGPTCoding. NSFW posts are filtered out. Minimum 20 upvotes to be considered. Rate-limited at 1.5 seconds between subreddit fetches.

**Scoring formula:** `(baseScore × 3 + aiRelevance × 12 + velocity × 2 + ecosystemBacking × 2 + revenueFunding × 2 + verifiableInfra × 3) × heat × subTier × domainTrust × upvoteRatio`

| Signal | In plain English | How it's calculated | Weight/Range |
|--------|-----------------|-------------------|-------------|
| Base score | How popular is this post? | `log2(Reddit upvotes)` — 100pts = 6.6, 400pts = 8.6. Compresses so mega-posts don't drown everything | ×3 in formula |
| AI relevance | How AI-related is this? | Same 3-tier keyword match as HN (see keyword lists above). For self-posts, also checks the first 500 characters of the body text. **Dominant signal** | ×12 in formula (0-1 scale) |
| Velocity | How fast is this gaining upvotes? | `upvotes per hour / 50`, capped at 2.0 | ×2 in formula |
| Ecosystem/backing | Is a notable backer involved? | 1 if title/body mentions YC, a16z, Product Hunt, Sequoia, Techstars, etc. 0 otherwise | ×2 in formula |
| Revenue/funding | Is there a money milestone? | 1 if title/body mentions ARR, MRR, revenue, seed round, Series A/B/C, raised $X, etc. 0 otherwise | ×2 in formula |
| Verifiable AI infra | Is this about provably secure AI? | 1 if title/body mentions TEE, ZK proofs, secure enclaves **and** AI terms. 0 otherwise | ×3 in formula |
| Discussion heat | Are people actually debating this? | Comment-to-upvote ratio → 1.0-1.5× multiplier | 1.0-1.5× multiplier |
| Subreddit tier | Is this from a core builder community? | Core (r/AutoGPT, r/LangChain, r/LocalLLaMA) = 1.3×. Major (r/MachineLearning, r/OpenAI, r/Anthropic) = 1.1×. General = 1.0× | 1.0-1.3× multiplier |
| Domain trust | Is the linked source reputable? | Self-posts = 1.0×. Tier 1 AI domains (openai.com, arxiv.org, etc.) = 1.2×, Tier 2 (github.com, pytorch.org) = 1.1× | 1.0-1.2× multiplier |
| Upvote ratio | Does the community actually agree this is good? | >95% = 1.15× boost. 85-95% = 1.0×. 70-85% = 0.9×. <70% = 0.8× penalty | 0.8-1.15× multiplier |

**Body text scanning:** For Reddit self-posts, the AI relevance, ecosystem/backing, revenue/funding, and verifiable infra signals check the first 500 characters of the post body in addition to the title. A post where someone describes their YC-backed seed round in the body text (not just the title) still gets caught.

**Column split:** Posts <24 hours old go into "Hottest Today." Posts 1-7 days old with ≥30 upvotes go into "Trending This Week." Each column's top 30 go to Claude for final selection of 10.

### Claude semantic filter

After numeric scoring produces the top 30 candidates per column per source, the list is sent to Claude Sonnet 4.5 as a numbered list with metadata:

```
1. "Epoch confirms GPT5.4 Pro solved a frontier math problem" (342pts, 89 comments, 3h ago, arxiv.org) [top]
2. "Show HN: MCP server for Postgres" (45pts, 12 comments, 5h ago, github.com) [show_hn]
...
```

Claude receives a source-specific prompt telling it to select the 10 most valuable items. The prompt specifies what to **keep** (major AI announcements, new tools, Show HN posts, viral launches, ecosystem-backed projects, revenue/funding milestones, verifiable AI infrastructure) and what to **remove** (off-topic, duplicates covering the same event, clickbait, rage-bait, low-effort content).

Claude returns a JSON array of its picks: `[1, 2, 7, ...]`. These become the final 10 items shown in the digest column.

**What Claude catches that numbers can't:** a cryptically-named repo that's actually a breakthrough agent tool, two posts covering the same announcement (keeps the better one), a 300-point rage-bait post vs. a 50-point Show HN that's genuinely novel, or a "ZK proof" post that's about blockchain rather than AI inference.

If the Claude API call fails, the system falls back to the top 10 by numeric score — so scoring is never a single point of failure.

### Cross-source amplification

In `lib/pipeline.ts`, after all three sources are fetched, the pipeline checks if any HN story or Reddit post links to a GitHub repo that's also in the GitHub results. If so, both items get a 1.5× velocity boost. This surfaces stories that are generating buzz across multiple communities simultaneously.

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
