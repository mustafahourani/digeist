import Anthropic from "@anthropic-ai/sdk";
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import type { GitHubRepo } from "@/lib/types";
import { getYesterday, NON_LATIN_RE } from "@/lib/utils";
import { getDigest } from "@/lib/storage";

const GITHUB_API = "https://api.github.com";
const STAR_CACHE_PATH = path.join(process.cwd(), "data", "github-star-cache.json");
const MS_PER_DAY = 86_400_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── Rate Limiter ──────────────────────────────────────────────────
// GitHub Search API: 30 requests/minute for authenticated users.
// Reads X-RateLimit-Remaining and X-RateLimit-Reset headers to
// automatically pause before hitting the wall.

const rateLimiter = {
  remaining: 30,
  resetAt: 0,

  update(headers: Headers) {
    const rem = headers.get("x-ratelimit-remaining");
    const reset = headers.get("x-ratelimit-reset");
    if (rem != null) this.remaining = parseInt(rem, 10);
    if (reset != null) this.resetAt = parseInt(reset, 10) * 1000; // epoch ms
  },

  getWaitTime(): number {
    return Math.max(this.resetAt - Date.now() + 1000, 0); // +1s buffer
  },

  async waitIfNeeded() {
    if (this.remaining > 2) return; // plenty of headroom
    const wait = this.getWaitTime();
    if (wait > 0 && wait <= 65_000) {
      console.log(`[GitHub] Rate limit low (${this.remaining} left) — pausing ${Math.ceil(wait / 1000)}s until reset...`);
      await sleep(wait);
      this.remaining = 30; // assume reset happened
    }
  },
};

interface GitHubApiRepo {
  full_name: string;
  description: string | null;
  html_url: string;
  stargazers_count: number;
  forks_count: number;
  language: string | null;
  topics: string[];
  pushed_at: string;
  created_at: string;
  owner: {
    login: string;
    type: string;
  };
}

interface GitHubSearchResponse {
  total_count: number;
  items: GitHubApiRepo[];
}

interface StarCache {
  [repoName: string]: { stars: number; forks?: number; updated_at: string };
}

// ─── Layer 4: Org Reputation ────────────────────────────────────────

const ORG_TIER_MAJOR = new Set([
  "openai", "anthropics", "google-deepmind", "meta-llama",
  "facebookresearch", "mistralai", "huggingface", "nvidia",
  "stability-ai", "deepseek-ai", "google-research", "apple",
  "microsoft", "meta-ai",
]);

const ORG_TIER_KNOWN = new Set([
  "langchain-ai", "langgenius", "run-llama", "ollama",
  "ggerganov", "vllm-project", "vercel", "together-ai",
  "replicate", "modal-labs", "anyscale", "cohere-ai",
  "eleutherai", "togethercomputer", "mlc-ai", "lm-sys",
  "comfyanonymous", "automatic1111", "invoke-ai",
  "transformerlab", "unslothai", "axolotl-ai-cloud",
]);

function getOrgTier(owner: string): "major" | "known" | "indie" {
  const lower = owner.toLowerCase();
  if (ORG_TIER_MAJOR.has(lower)) return "major";
  if (ORG_TIER_KNOWN.has(lower)) return "known";
  return "indie";
}

function orgScore(tier: "major" | "known" | "indie"): number {
  if (tier === "indie") return 3;   // Unknown builders = highest discovery value
  if (tier === "known") return 1;   // Community already follows these
  return 0;                          // Major orgs surface via HN anyway
}

// ─── Star Cache (Layer 2) ───────────────────────────────────────────

async function loadStarCache(): Promise<StarCache> {
  try {
    const raw = await readFile(STAR_CACHE_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function saveStarCache(cache: StarCache): Promise<void> {
  await mkdir(path.dirname(STAR_CACHE_PATH), { recursive: true });
  await writeFile(STAR_CACHE_PATH, JSON.stringify(cache, null, 2));
}

// ─── GitHub Trending Scrape (Layer 1) ───────────────────────────────

interface TrendingRepo {
  name: string; // "owner/repo"
  starsDelta: number; // stars gained today
}

async function scrapeTrendingPage(language?: string): Promise<TrendingRepo[]> {
  const url = language
    ? `https://github.com/trending/${encodeURIComponent(language)}?since=daily`
    : "https://github.com/trending?since=daily";

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Digeist/1.0",
        Accept: "text/html",
      },
    });

    if (!response.ok) return [];
    const html = await response.text();

    const repos: TrendingRepo[] = [];
    // Parse trending repos from HTML
    // Each repo is in an <article> with an h2 containing the repo link
    const articleRegex = /<article[^>]*class="[^"]*Box-row[^"]*"[^>]*>([\s\S]*?)<\/article>/g;
    let match;

    while ((match = articleRegex.exec(html)) !== null) {
      const article = match[1];

      // Extract repo name from the h2 > a href
      const nameMatch = article.match(/href="\/([^"]+?)"\s/);
      if (!nameMatch) continue;
      const name = nameMatch[1].trim();

      // Extract "X stars today" count
      const starsMatch = article.match(/([\d,]+)\s+stars?\s+today/i);
      const starsDelta = starsMatch
        ? parseInt(starsMatch[1].replace(/,/g, ""), 10)
        : 0;

      if (name.includes("/")) {
        repos.push({ name, starsDelta });
      }
    }

    return repos;
  } catch (err) {
    console.error(`[GitHub] Trending scrape failed for ${language || "all"}:`, err);
    return [];
  }
}

// ─── API Helpers ────────────────────────────────────────────────────

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

async function searchRepos(query: string): Promise<GitHubApiRepo[]> {
  // Check rate limit before making request
  await rateLimiter.waitIfNeeded();

  const params = new URLSearchParams({
    q: query,
    sort: "updated",
    order: "desc",
    per_page: "30",
  });

  const response = await fetch(
    `${GITHUB_API}/search/repositories?${params}`,
    { headers: getHeaders() }
  );

  // Update rate limit state from response headers
  rateLimiter.update(response.headers);

  if (!response.ok) {
    // If rate limited, wait and retry once
    if (response.status === 403 || response.status === 429) {
      const retryAfter = rateLimiter.getWaitTime();
      if (retryAfter > 0 && retryAfter <= 65_000) {
        console.log(`[GitHub] Rate limited — waiting ${Math.ceil(retryAfter / 1000)}s before retry...`);
        await sleep(retryAfter);
        return searchRepos(query);
      }
    }
    const body = await response.text();
    throw new Error(`GitHub API error ${response.status}: ${body}`);
  }

  const data: GitHubSearchResponse = await response.json();
  return data.items || [];
}

// ─── Categorization ────────────────────────────────────────────────

function categorizeRepo(repo: GitHubApiRepo): string {
  const topics = repo.topics.map((t) => t.toLowerCase());
  const desc = (repo.description || "").toLowerCase();
  const name = repo.full_name.toLowerCase();
  const lang = (repo.language || "").toLowerCase();
  const all = [...topics, desc, name].join(" ");

  if (all.match(/\b(mcp|model.context.protocol)\b/)) return "MCP";
  if (all.match(/\b(ai.code|code.editor|copilot|code.gen|vibe.coding|code.assistant)\b/)) return "AI Coding";
  if (all.match(/\b(ai.agent|autonomous.agent|agent.framework|multi.agent|tool.use)\b/)) return "AI Agents";
  if (all.match(/\b(local.llm|on.device|edge.ai|ollama|llama\.cpp|mlx|gguf|ggml)\b/)) return "Local AI";
  if (all.match(/\b(voice.ai|speech|tts|text.to.speech|whisper|audio.model)\b/)) return "Voice AI";
  if (all.match(/\b(vision.language|multimodal|text.to.video|image.to)\b/)) return "Multimodal";
  if (all.match(/\b(ai.search|search.engine|perplexity|ai.browser)\b/)) return "AI Search";
  if (all.match(/\b(rag|retrieval.augmented|vector.database|embedding)\b/)) return "RAG";
  if (all.match(/\b(llm|large.language.model|gpt|transformer|tokenizer)\b/)) return "LLM";
  if (all.match(/\b(diffusion|stable.diffusion|image.generation|text.to.image)\b/)) return "Image Gen";
  if (all.match(/\b(fine.tun|lora|qlora|peft|adapter)\b/)) return "Fine-tuning";
  if (all.match(/\b(langchain|llamaindex|crewai|autogen|dspy)\b/)) return "AI Framework";
  if (all.match(/\b(inference|serving|vllm|tgi|onnx|quantiz|gateway|router)\b/)) return "Inference";
  if (all.match(/\b(eval|benchmark|leaderboard|synthetic.data)\b/)) return "Eval & Data";
  if (all.match(/\b(computer.vision|object.detection|segmentation|yolo)\b/)) return "Computer Vision";
  if (all.match(/\b(reinforcement.learning|rlhf|ppo|reward.model)\b/)) return "RL";
  if (all.match(/\b(deep.learning|neural.network|pytorch|tensorflow)\b/)) return "Deep Learning";
  if (lang === "python") return "Python ML";
  if (lang === "typescript" || lang === "javascript") return "TypeScript AI";
  if (lang === "rust") return "Rust";
  if (lang === "go") return "Go";
  return "AI/ML";
}

// ─── Keyword Queries (catch untagged repos) ─────────────────────────

const KEYWORD_QUERIES = [
  // Agentic core
  "MCP server",
  "AI agent framework",
  "\"tool use\" LLM",
  "\"autonomous agent\" OR agentic",
  "\"multi-agent\" OR \"agent orchestration\"",
  "\"function calling\" OR \"tool calling\"",
  // Agent products & workflows
  "AI workflow OR \"agent workflow\"",
  "\"AI assistant\" OR \"AI copilot\"",
  "\"computer use\" OR \"browser agent\"",
  // AI Coding (agents building code)
  "AI code editor",
  "\"code generation\" LLM",
  "vibe coding",
  // Agent infrastructure
  "local LLM",
  "\"voice AI\" OR \"speech AI\" OR TTS",
  "LLM serving OR \"LLM inference\"",
  "AI gateway OR \"model router\"",
  // Agent data & retrieval
  "RAG pipeline OR \"vector database\"",
];

// ─── Claude Dynamic Query Generation ────────────────────────────────
// Reads yesterday's digest (GitHub repos + HN stories) and generates
// additional targeted search queries based on what's actually trending NOW.
// This makes the search adaptive rather than static.

async function generateDynamicQueries(client: Anthropic): Promise<string[]> {
  try {
    const yesterday = getYesterday();
    const digest = await getDigest(yesterday);
    if (!digest) {
      console.log("[GitHub] No yesterday digest — skipping dynamic queries");
      return [];
    }

    // Build context from yesterday's signals (safe access — sections may be empty)
    const newRepos = digest.sections.github?.new_repos || [];
    const trendRepos = digest.sections.github?.trending_repos || [];
    const allGhRepos = [...newRepos, ...trendRepos];
    const yesterdayRepos = allGhRepos
      .slice(0, 10)
      .map((r) => `- ${r.name}: ${(r.description || "").slice(0, 80)}`)
      .join("\n") || "(no data)";

    const hnSection = digest.sections.hackernews;
    const allHnStories = [
      ...(hnSection?.hot_stories || []),
      ...(hnSection?.rising_stories || []),
    ];
    const hnTopics = allHnStories
      .slice(0, 5)
      .map((s) => `- ${s.title}`)
      .join("\n") || "(no data)";

    // Existing static queries for dedup
    const existingKeywords = KEYWORD_QUERIES.join(", ");

    console.log("[GitHub] Generating dynamic queries from yesterday's context...");

    const response = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 512,
      messages: [{
        role: "user",
        content: `You are helping curate a daily AI GitHub digest focused on AI agents and what people are building with them.

Based on yesterday's trending topics across Hacker News and GitHub, generate 3-5 GitHub search queries that would catch repos our STATIC keywords might miss.

YESTERDAY'S TOP GITHUB REPOS:
${yesterdayRepos}

YESTERDAY'S HACKER NEWS:
${hnTopics}

OUR EXISTING STATIC KEYWORDS (don't duplicate these):
${existingKeywords}

RULES:
- Each query must be a GitHub search string (goes into the q= parameter)
- Max 5 AND/OR/NOT operators per query (GitHub hard limit)
- Focus on specific product names, tools, techniques, or trends that are hot RIGHT NOW but aren't covered by our static keywords
- Don't generate generic queries like "AI tool" — be specific to what's trending
- Return ONLY a JSON array of query strings. Example: ["query1", "query2", "query3"]`,
      }],
    });

    const text = response.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") return [];

    const jsonMatch = text.text.match(/\[[\s\S]*?\]/);
    if (!jsonMatch) return [];

    const queries: string[] = JSON.parse(jsonMatch[0]);
    const valid = queries
      .filter((q) => typeof q === "string" && q.length > 2)
      .slice(0, 5);

    console.log(`[GitHub] Dynamic queries from Claude: ${valid.map((q) => `"${q}"`).join(", ")}`);
    return valid;
  } catch (err) {
    console.error("[GitHub] Dynamic query generation failed:", err);
    return [];
  }
}

// ─── Claude Semantic Relevance Scoring ──────────────────────────────
// After gathering all repos and computing numeric signals 1-8, Claude rates
// the top candidates on a 1-10 scale for how interesting/relevant they are
// to AI agents and practical builds. This becomes Signal 9 in the formula.

async function claudeRelevanceScores(
  repos: Map<string, GitHubApiRepo>,
  client: Anthropic
): Promise<Map<string, number>> {
  const scores = new Map<string, number>();
  if (repos.size === 0) return scores;

  // Take top 50 by stars (rough proxy before full scoring) to keep prompt manageable
  const candidates = [...repos.values()]
    .filter((r) => isLikelyEnglishRepo(r))
    .sort((a, b) => b.stargazers_count - a.stargazers_count)
    .slice(0, 50);

  if (candidates.length === 0) return scores;

  const repoList = candidates.map((r, i) => {
    const forks = r.forks_count > 0 ? `, ${r.forks_count} forks` : "";
    return `${i + 1}. ${r.full_name} (${r.stargazers_count}★${forks}, ${r.language || "?"}) — ${r.description || "no description"} — topics: ${r.topics.slice(0, 5).join(", ") || "none"}`;
  }).join("\n");

  try {
    console.log(`[GitHub] Claude semantic scoring: rating ${candidates.length} repos...`);

    const response = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: `Rate each repo 1-10 on how interesting it is for an AI practitioner focused on AI agents and what people are building with them.

SCORING GUIDE:
- 9-10: Groundbreaking agent tool, novel MCP server, first-of-its-kind AI application
- 7-8: Solid practical tool for agents/AI, interesting infrastructure, creative use of LLMs
- 5-6: Tangentially related to AI agents, useful but not novel
- 3-4: General ML/AI but not agent-related, standard tutorials
- 1-2: Not actually AI-related, spam, or extremely generic

Return ONLY a JSON object mapping repo number to score.
Example: {"1": 8, "2": 3, "5": 9, ...}
You MUST rate every repo. Be decisive.

Repos:
${repoList}`,
      }],
    });

    const text = response.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") return scores;

    const jsonMatch = text.text.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) return scores;

    const rawScores: Record<string, number> = JSON.parse(jsonMatch[0]);

    for (const [indexStr, score] of Object.entries(rawScores)) {
      const idx = parseInt(indexStr, 10) - 1;
      if (idx >= 0 && idx < candidates.length && typeof score === "number") {
        scores.set(candidates[idx].full_name, Math.min(Math.max(score, 1), 10));
      }
    }

    const avgScore = [...scores.values()].reduce((a, b) => a + b, 0) / scores.size;
    console.log(`[GitHub] Claude scored ${scores.size} repos (avg: ${avgScore.toFixed(1)}/10)`);
    return scores;
  } catch (err) {
    console.error("[GitHub] Claude semantic scoring failed:", err);
    return scores;
  }
}

// ─── Layer 3: Multi-Signal Scoring ──────────────────────────────────

interface ScoredRepo {
  repo: GitHubApiRepo;
  starsDelta: number;
  isTrending: boolean;
  orgTier: "major" | "known" | "indie";
  queryHits: number;
  finalScore: number;
}

function freshnessTier(repo: GitHubApiRepo): number {
  const ageMs = Date.now() - new Date(repo.created_at).getTime();
  const ageDays = ageMs / MS_PER_DAY;

  if (ageDays < 1) return 8;      // Born today — strongest signal
  if (ageDays < 3) return 5;      // Last few days
  if (ageDays < 7) return 3;      // This week
  if (ageDays < 14) return 1;     // Last two weeks
  if (ageDays < 30) return 0.3;   // Last month — mostly noise unless huge delta
  return 0;                        // Older — only star delta can save it
}

function computeRepoScore(
  repo: GitHubApiRepo,
  starsDelta: number,
  isTrending: boolean,
  queryHits: number,
  claudeScore?: number
): ScoredRepo {
  const tier = getOrgTier(repo.owner.login);

  // Signal 1: Star delta (log2 compressed) — "hot right now" signal
  // 100 delta → 6.6, 500 delta → 9.0, 1000 delta → 10.0 — capped at 10
  const deltaScore = starsDelta > 0
    ? Math.min(Math.log2(Math.max(starsDelta, 1)) * 1.5, 10)
    : 0;

  // Signal 2: Stars-per-day velocity — fallback when no delta available
  const ageMs = Date.now() - new Date(repo.created_at).getTime();
  const ageDays = Math.max(ageMs / MS_PER_DAY, 1);
  const starsPerDay = repo.stargazers_count / ageDays;
  const velocityScore = starsDelta > 0
    ? 0  // Don't double-count when we have real delta
    : Math.min(Math.log2(Math.max(starsPerDay, 0.1) + 1) * 2, 6);

  // Signal 3: Freshness tier
  const freshness = freshnessTier(repo);

  // Signal 4: Trending page bonus
  const trendingBonus = isTrending ? 4 : 0;

  // Signal 5: Query hit count — breadth of relevance
  // Repo matched 5 queries = broadly relevant
  const hitBonus = Math.min(queryHits - 1, 4) * 0.5; // -1 because first hit is baseline

  // Signal 6: Org reputation
  const orgBonus = orgScore(tier);

  // Signal 7: Forks — someone building on this is higher signal than a star
  // Forks cap HIGHER than star delta (12 vs 10) because forks = real usage
  const forkScore = repo.forks_count > 0
    ? Math.min(Math.log2(repo.forks_count + 1) * 2.5, 12)
    : 0;

  // Signal 8: Fork-to-star ratio — high ratio = people actually using this, not just bookmarking
  // 30%+ ratio is exceptional (e.g. 30 stars, 10 forks), 15%+ is notable
  const forkRatio = repo.stargazers_count > 10
    ? repo.forks_count / repo.stargazers_count
    : 0;
  const forkRatioBonus = forkRatio > 0.3 ? 5 : forkRatio > 0.15 ? 2.5 : 0;

  // Signal 9: Claude semantic relevance — AI judges how interesting this repo is
  // for AI agents and practical builds. Score 1-10 from Claude, scaled to 0-15 pts.
  // This is the single highest-cap signal because Claude understands context
  // that numbers can't (e.g. a repo called "garden-planner" is actually an agent orchestration framework)
  const semanticScore = claudeScore != null
    ? (claudeScore / 10) * 15  // 10/10 → 15pts, 5/10 → 7.5pts, 1/10 → 1.5pts
    : 0;

  const finalScore =
    deltaScore +
    velocityScore +
    freshness +
    trendingBonus +
    hitBonus +
    orgBonus +
    forkScore +
    forkRatioBonus +
    semanticScore;

  return {
    repo,
    starsDelta,
    isTrending,
    orgTier: tier,
    queryHits,
    finalScore,
  };
}

function isLikelyEnglishRepo(repo: GitHubApiRepo): boolean {
  const text = `${repo.full_name} ${repo.description || ""}`;
  return !NON_LATIN_RE.test(text);
}

// ─── Claude AI-Relevance Filter ─────────────────────────────────────

function formatRepoForClaude(s: ScoredRepo, i: number): string {
  const r = s.repo;
  const forks = r.forks_count > 0 ? `, ${r.forks_count} forks` : "";
  return `${i + 1}. ${r.full_name} (${r.stargazers_count}★, +${s.starsDelta}★ today${forks}, ${r.language || "unknown"}) — ${r.description || "no description"} — topics: ${r.topics.slice(0, 5).join(", ") || "none"}`;
}

async function filterColumnWithClaude(
  candidates: ScoredRepo[],
  columnType: "new" | "trending",
  client: Anthropic
): Promise<ScoredRepo[]> {
  if (candidates.length === 0) return [];

  // Filter non-English repos
  const englishCandidates = candidates.filter((s) => isLikelyEnglishRepo(s.repo));
  const removedLang = candidates.length - englishCandidates.length;
  if (removedLang > 0) {
    console.log(`[GitHub] Language filter (${columnType}): removed ${removedLang} non-English repos`);
  }

  if (englishCandidates.length === 0) return [];

  const repoList = englishCandidates.map((s, i) => formatRepoForClaude(s, i)).join("\n");

  const columnPrompt = columnType === "new"
    ? `You are curating the "NEW — Last 24 Hours" column of a daily AI digest focused on AI agents and what people are building with them. These repos were all CREATED in the last day.

From these ${englishCandidates.length} repos, select the top 10 most interesting.

FOCUS ON NOVELTY & SURPRISE:
- What's genuinely new? What hasn't been done before?
- Indie developers and small teams launching something fresh
- First-of-its-kind tools (first MCP server for X, first agent that does Y)
- Creative applications of AI that show where the field is heading
- High fork counts = people are building on this, strong quality signal

REMOVE:
- Repos NOT actually about AI, ML, LLMs, agents, or related technology
- Tutorials, awesome-lists, collections with no real code
- Spam, forks with no original work, or inflated-star repos
- Generic boilerplate projects (yet another chatbot wrapper with no novel approach)`

    : `You are curating the "TRENDING — Gaining Traction" column of a daily AI digest focused on AI agents and what people are building with them. These are older repos that gained stars/forks in the last 24 hours.

From these ${englishCandidates.length} repos, select the top 10 most interesting.

FOCUS ON "WHY NOW?":
- Why is this suddenly getting traction today? What changed?
- New major release, viral demo, or real-world adoption milestone
- Tools that crossed a usability threshold (from experimental → production-ready)
- High fork-to-star ratio or fork growth = people are actually building on this, not just bookmarking

DEPRIORITIZE:
- Well-known repos from major orgs (OpenAI, Google, Meta) UNLESS the update is genuinely significant
- Established projects with routine activity (minor bumps, docs)
- Repos that trend every week with no real news

REMOVE:
- Repos NOT actually about AI, ML, LLMs, agents, or related technology
- Low-quality tutorials, awesome-lists, or collection repos
- Spam or self-promotion`;

  try {
    console.log(`[GitHub] Claude filter (${columnType}): analyzing ${englishCandidates.length} candidates...`);

    const response = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: `${columnPrompt}

Return ONLY a JSON array of the selected repo numbers (1-indexed), ordered by discovery value — most interesting first.
Example: [1, 3, 5, 7, ...]

Repos:
${repoList}`,
      }],
    });

    const text = response.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") throw new Error("No text response");

    const jsonMatch = text.text.match(/\[[\d,\s]+\]/);
    if (!jsonMatch) throw new Error("No JSON array found in response");

    const selectedIndices: number[] = JSON.parse(jsonMatch[0]);
    const selected = selectedIndices
      .filter((i) => i >= 1 && i <= englishCandidates.length)
      .slice(0, 10)
      .map((i) => englishCandidates[i - 1]);

    console.log(
      `[GitHub] Claude (${columnType}): selected ${selected.length}/${englishCandidates.length} — ${selected.slice(0, 3).map((s) => s.repo.full_name).join(", ")}...`
    );

    return selected;
  } catch (err) {
    console.error(`[GitHub] Claude filter (${columnType}) failed, using score-based fallback:`, err);
    return englishCandidates.slice(0, 10);
  }
}

// ─── Claude Description Enhancement ─────────────────────────────────
// Takes the final selected repos and rewrites their raw GitHub descriptions
// into concise, useful snippets that tell a reader what it actually does.

async function enhanceDescriptions(
  repos: GitHubRepo[],
  client: Anthropic
): Promise<Map<string, string>> {
  const enhanced = new Map<string, string>();
  if (repos.length === 0) return enhanced;

  const repoList = repos.map((r, i) => {
    const forks = r.forks && r.forks > 0 ? `, ${r.forks} forks` : "";
    return `${i + 1}. ${r.name} (${r.stars}★${forks}, ${r.language}) — "${r.description}"`;
  }).join("\n");

  try {
    console.log(`[GitHub] Claude description enhancement: rewriting ${repos.length} descriptions...`);

    const response = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 2048,
      messages: [{
        role: "user",
        content: `Rewrite each repo description into a clear, informative 1-sentence snippet (max 120 chars) for an AI practitioner scanning a daily digest.

RULES:
- Start with what it IS or DOES — be concrete and specific
- "MCP server that connects Claude to Postgres for schema inspection and natural language queries" > "AI-powered database tool"
- "kubectl for agents" is too vague — say what it actually does: "CLI to deploy, monitor, and restart LLM agent containers across clusters"
- Mention key technical specifics when possible: model names, protocols (MCP, gRPC), frameworks
- If the original description is already clear and specific, keep it as-is
- Don't speculate — only describe what the repo name + description tell you
- No emojis, no hype words ("revolutionary", "powerful", "ultimate")
- No vague analogies — describe the actual functionality

Return ONLY a JSON object mapping repo number to rewritten description.
Example: {"1": "CLI tool that runs LLM agents against local codebases with auto-context from git history", "2": "Hybrid vector store combining BM25 and embeddings, optimized for RAG with streaming results"}

Repos:
${repoList}`,
      }],
    });

    const text = response.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") return enhanced;

    const jsonMatch = text.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return enhanced;

    const descriptions: Record<string, string> = JSON.parse(jsonMatch[0]);

    for (const [indexStr, desc] of Object.entries(descriptions)) {
      const idx = parseInt(indexStr, 10) - 1;
      if (idx >= 0 && idx < repos.length && typeof desc === "string" && desc.length > 0) {
        enhanced.set(repos[idx].name, desc.slice(0, 150));
      }
    }

    console.log(`[GitHub] Enhanced ${enhanced.size}/${repos.length} descriptions`);
    return enhanced;
  } catch (err) {
    console.error("[GitHub] Description enhancement failed, using originals:", err);
    return enhanced;
  }
}

// ─── Main Fetch Function ────────────────────────────────────────────

export async function fetchGitHubTrending(
  topics: string[],
  minStars: number
): Promise<{ new_repos: GitHubRepo[]; trending_repos: GitHubRepo[] }> {
  // ── Layer 1: Scrape GitHub Trending pages ──
  console.log("[GitHub] Scraping trending pages...");
  const [trendingAll, trendingPy, trendingTS, trendingRust] = await Promise.all([
    scrapeTrendingPage(),
    scrapeTrendingPage("python"),
    scrapeTrendingPage("typescript"),
    scrapeTrendingPage("rust"),
  ]);

  // Merge trending data — keep highest delta per repo
  const trendingMap = new Map<string, number>();
  for (const list of [trendingAll, trendingPy, trendingTS, trendingRust]) {
    for (const { name, starsDelta } of list) {
      const existing = trendingMap.get(name) || 0;
      if (starsDelta > existing) {
        trendingMap.set(name, starsDelta);
      }
    }
  }

  console.log(
    `[GitHub] Trending: ${trendingMap.size} repos from 4 pages (${trendingAll.length} all, ${trendingPy.length} Python, ${trendingTS.length} TS, ${trendingRust.length} Rust)`
  );

  // Validate scraper is working — warn if all pages returned 0 results
  if (trendingMap.size === 0) {
    console.warn(
      "[GitHub] WARNING: Trending scraper returned 0 repos across all pages. " +
      "GitHub may have changed their HTML structure. Star delta data will be unavailable."
    );
  }

  // ── Claude: Generate dynamic queries from yesterday's context ──
  const client = new Anthropic();
  const dynamicQueries = await generateDynamicQueries(client);

  // ── Layer 2: Load star cache for delta calculation ──
  const starCache = await loadStarCache();

  // ── API Search: topic + keyword + dynamic + new + rising queries ──
  const allRepos = new Map<string, GitHubApiRepo>();
  const queryHitCount = new Map<string, number>(); // Layer 5: hit counting

  const yesterday = getYesterday();
  const oneWeekAgo = new Date(Date.now() - 7 * MS_PER_DAY).toISOString().split("T")[0];
  const oneMonthAgo = new Date(Date.now() - 30 * MS_PER_DAY).toISOString().split("T")[0];

  // Topic-based searches (repos tagged with these topics, pushed recently)
  const topicQueries = topics.map(
    (topic) => `topic:${topic} stars:>${minStars} pushed:>${yesterday}`
  );

  // Keyword-based searches — require 100+ stars to avoid noise from generic keyword matches
  const keywordMinStars = Math.max(minStars, 100);
  const keywordQueries = KEYWORD_QUERIES.map(
    (kw) => `${kw} in:name,description stars:>${keywordMinStars} pushed:>${yesterday}`
  );

  // Claude-generated queries based on what's actually trending right now
  const dynamicKeywordQueries = dynamicQueries.map(
    (kw) => `${kw} in:name,description stars:>${keywordMinStars} pushed:>${yesterday}`
  );

  // Brand new repos getting traction
  const newRepoQueries = [
    // Born in last 24h — even modest traction is signal (10+ stars on day one is notable)
    `AI OR LLM OR agent OR model created:>${yesterday} stars:>10`,
    // Born in last 7 days — need more traction to qualify
    `AI OR LLM OR agent OR model OR inference created:>${oneWeekAgo} stars:>50`,
  ];

  // 30-day repos only if massive traction (the edge case — old-ish but suddenly viral)
  const risingRepoQueries = [
    `AI OR LLM OR agent OR model created:>${oneMonthAgo} stars:>500`,
  ];

  const allQueries = [...topicQueries, ...keywordQueries, ...dynamicKeywordQueries, ...newRepoQueries, ...risingRepoQueries];
  console.log(`[GitHub] Query budget: ${topicQueries.length} topic + ${keywordQueries.length} keyword + ${dynamicKeywordQueries.length} dynamic + ${newRepoQueries.length} new + ${risingRepoQueries.length} rising = ${allQueries.length} total`);

  // Run in batches of 5 to respect GitHub rate limits
  for (let i = 0; i < allQueries.length; i += 5) {
    const batch = allQueries.slice(i, i + 5);
    const results = await Promise.allSettled(
      batch.map((q) => searchRepos(q))
    );

    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      if (result.status === "fulfilled") {
        for (const repo of result.value) {
          // Layer 5: Count how many queries each repo matches
          const current = queryHitCount.get(repo.full_name) || 0;
          queryHitCount.set(repo.full_name, current + 1);

          if (!allRepos.has(repo.full_name)) {
            allRepos.set(repo.full_name, repo);
          }
        }
      } else {
        console.error("[GitHub] Search failed:", result.reason);
      }
    }
  }

  console.log(`[GitHub] Found ${allRepos.size} unique repos across ${allQueries.length} queries`);

  // ── Compute deltas from star/fork cache ──
  // Only use cache entries from the last 36 hours so deltas always represent ~24h of change.
  // If a repo wasn't seen yesterday, we skip the delta rather than showing a multi-day number.
  const STALE_MS = 36 * 60 * 60 * 1000; // 36h — gives buffer for pipeline timing
  const deltasFromCache = new Map<string, number>();
  const forkDeltasFromCache = new Map<string, number>();
  for (const [name, repo] of allRepos) {
    const cached = starCache[name];
    if (cached) {
      const cacheAge = Date.now() - new Date(cached.updated_at).getTime();
      if (cacheAge <= STALE_MS) {
        const starDelta = repo.stargazers_count - cached.stars;
        if (starDelta > 0) {
          deltasFromCache.set(name, starDelta);
        }
        if (cached.forks != null) {
          const forkDelta = repo.forks_count - cached.forks;
          if (forkDelta > 0) {
            forkDeltasFromCache.set(name, forkDelta);
          }
        }
      }
    }
    // Update cache with current stars + forks
    starCache[name] = {
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      updated_at: new Date().toISOString(),
    };
  }

  // Also add trending repos to cache
  for (const [name, delta] of trendingMap) {
    if (!starCache[name]) {
      starCache[name] = {
        stars: delta, // approximate — we only know delta
        forks: 0,
        updated_at: new Date().toISOString(),
      };
    }
  }

  // Persist updated cache
  await saveStarCache(starCache);

  if (deltasFromCache.size > 0 || forkDeltasFromCache.size > 0) {
    console.log(
      `[GitHub] Cache deltas: ${deltasFromCache.size} repos with star delta, ${forkDeltasFromCache.size} with fork delta`
    );
  }

  // ── Claude Semantic Scoring (Signal 9) ──
  // Run on top 50 repos by stars — Claude rates each 1-10 for relevance to AI agents
  const semanticScores = await claudeRelevanceScores(allRepos, client);

  // ── Layer 3: Score every repo, split into new vs trending ──
  const scoredNew: ScoredRepo[] = [];     // created in last 24h
  const scoredTrending: ScoredRepo[] = []; // older, with traction

  for (const [name, repo] of allRepos) {
    // Best available delta: trending page > cache > 0
    const trendingDelta = trendingMap.get(name) || 0;
    const cacheDelta = deltasFromCache.get(name) || 0;
    const starsDelta = Math.max(trendingDelta, cacheDelta);

    const isTrending = trendingMap.has(name);
    const hits = queryHitCount.get(name) || 1;
    const claudeScore = semanticScores.get(name);
    const scored = computeRepoScore(repo, starsDelta, isTrending, hits, claudeScore);

    const ageMs = Date.now() - new Date(repo.created_at).getTime();
    const ageDays = ageMs / MS_PER_DAY;

    if (ageDays < 1) {
      // Brand new — goes to "new" column
      scoredNew.push(scored);
    } else if (ageDays <= 7) {
      // "Hot Last Week" — repos 1-7 days old
      // Qualifies if: has traction signal OR has meaningful stars (young + popular = hot)
      const forkDelta = forkDeltasFromCache.get(name) || 0;
      const isMajorOrg = scored.orgTier === "major";
      const claudeApproved = (claudeScore ?? 0) >= 7;
      const orgOk = !isMajorOrg || claudeApproved;
      const hasTraction = starsDelta > 0 || forkDelta > 0 || isTrending;
      const isPopularRecent = repo.stargazers_count >= 100; // 100+ stars in under a week = hot
      if (orgOk && (hasTraction || isPopularRecent)) {
        scoredTrending.push(scored);
      }
    }
    // Older with no traction signal → dropped
  }

  // Sort each bucket — Claude sees ALL qualified candidates, not a pre-filtered subset
  // Sorting ensures the highest-signal repos appear first in Claude's prompt
  const newCandidates = scoredNew
    .sort((a, b) => b.finalScore - a.finalScore);
  const trendingCandidates = scoredTrending
    .sort((a, b) => {
      // Blend total forks/stars (reliable data we always have) with delta (when available)
      // Total forks weighted highest since forks = real usage
      const aTotal = a.repo.forks_count * 3 + a.repo.stargazers_count;
      const bTotal = b.repo.forks_count * 3 + b.repo.stargazers_count;
      const aDelta = a.starsDelta + (forkDeltasFromCache.get(a.repo.full_name) || 0) * 3;
      const bDelta = b.starsDelta + (forkDeltasFromCache.get(b.repo.full_name) || 0) * 3;
      // Combined: total popularity (60%) + delta growth (40%)
      const aScore = aTotal * 0.6 + aDelta * 100 * 0.4; // scale delta up to match total range
      const bScore = bTotal * 0.6 + bDelta * 100 * 0.4;
      return bScore - aScore || b.finalScore - a.finalScore;
    });

  console.log(
    `[GitHub] Split: ${scoredNew.length} new (<24h), ${scoredTrending.length} trending (older with traction)`
  );

  // ── Claude AI-Relevance Filter (separate prompts per column) ──
  // (client already created at top of function for dynamic queries + semantic scoring)

  // Run both column filters in parallel — each gets its own tailored prompt
  const [newFiltered, trendingFiltered] = await Promise.all([
    filterColumnWithClaude(newCandidates, "new", client),
    filterColumnWithClaude(trendingCandidates, "trending", client),
  ]);

  function toGitHubRepo(s: ScoredRepo): GitHubRepo {
    const forksDelta = forkDeltasFromCache.get(s.repo.full_name) || 0;
    return {
      name: s.repo.full_name,
      description: s.repo.description || "",
      url: s.repo.html_url,
      stars: s.repo.stargazers_count,
      stars_delta: s.starsDelta > 0 ? s.starsDelta : undefined,
      language: s.repo.language || "Unknown",
      category: categorizeRepo(s.repo),
      forks: s.repo.forks_count,
      forks_delta: forksDelta > 0 ? forksDelta : undefined,
      is_trending: s.isTrending || undefined,
      org_tier: s.orgTier,
      created_at: s.repo.created_at,
    };
  }

  const new_repos = newFiltered.slice(0, 10).map(toGitHubRepo);
  const trending_repos = trendingFiltered.slice(0, 10).map(toGitHubRepo);

  // ── Claude Description Enhancement ──
  // Rewrite raw GitHub descriptions into concise, useful snippets
  const enhanced = await enhanceDescriptions([...new_repos, ...trending_repos], client);
  for (const repo of [...new_repos, ...trending_repos]) {
    const better = enhanced.get(repo.name);
    if (better) repo.description = better;
  }

  console.log(`[GitHub] Final: ${new_repos.length} new, ${trending_repos.length} trending`);

  return { new_repos, trending_repos };
}

