import Anthropic from "@anthropic-ai/sdk";
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import type { GitHubRepo } from "@/lib/types";
import { getYesterday, NON_LATIN_RE } from "@/lib/utils";

const GITHUB_API = "https://api.github.com";
const STAR_CACHE_PATH = path.join(process.cwd(), "data", "github-star-cache.json");
const MS_PER_DAY = 86_400_000;

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
  [repoName: string]: { stars: number; updated_at: string };
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
  if (tier === "major") return 2;
  if (tier === "known") return 1;
  return 0;
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

  if (!response.ok) {
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

  if (all.match(/\b(rag|retrieval.augmented|vector.database|embedding)\b/)) return "RAG";
  if (all.match(/\b(llm|large.language.model|gpt|transformer|tokenizer)\b/)) return "LLM";
  if (all.match(/\b(diffusion|stable.diffusion|image.generation|text.to.image)\b/)) return "Image Gen";
  if (all.match(/\b(ai.agent|autonomous.agent|agent.framework|multi.agent)\b/)) return "AI Agents";
  if (all.match(/\b(fine.tun|lora|qlora|peft|adapter)\b/)) return "Fine-tuning";
  if (all.match(/\b(langchain|llamaindex|crewai|autogen|dspy)\b/)) return "AI Framework";
  if (all.match(/\b(inference|serving|vllm|tgi|onnx|quantiz)\b/)) return "Inference";
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
  "LLM framework",
  "AI agent",
  "RAG pipeline",
  "fine-tuning LLM",
  "inference engine",
  "vector database",
  "prompt engineering",
  "text-to-image",
  "code assistant AI",
];

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

  if (ageDays < 7) return 5;      // Brand new
  if (ageDays < 30) return 3;     // Very fresh
  if (ageDays < 90) return 1.5;   // Recent
  if (ageDays < 365) return 0.8;  // Established
  return 0.3;                      // Old — active penalty
}

function computeRepoScore(
  repo: GitHubApiRepo,
  starsDelta: number,
  isTrending: boolean,
  queryHits: number
): ScoredRepo {
  const tier = getOrgTier(repo.owner.login);

  // Signal 1: Star delta (log2 compressed) — the primary "hot right now" signal
  // 100 delta → 6.6, 500 delta → 9.0, 1000 delta → 10.0
  const deltaScore = starsDelta > 0
    ? Math.log2(Math.max(starsDelta, 1)) * 1.5
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

  const finalScore =
    deltaScore +
    velocityScore +
    freshness +
    trendingBonus +
    hitBonus +
    orgBonus;

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

async function filterWithClaude(candidates: ScoredRepo[]): Promise<ScoredRepo[]> {
  if (candidates.length === 0) return [];

  // Filter non-English repos first
  const englishCandidates = candidates.filter((s) => isLikelyEnglishRepo(s.repo));
  const removedLang = candidates.length - englishCandidates.length;
  if (removedLang > 0) {
    console.log(`[GitHub] Language filter: removed ${removedLang} non-English repos`);
  }

  if (englishCandidates.length <= 15) return englishCandidates;

  try {
    console.log(`[GitHub] Running Claude relevance filter on ${englishCandidates.length} candidates...`);
    const client = new Anthropic();

    const repoList = englishCandidates.map((s, i) => {
      const r = s.repo;
      return `${i + 1}. ${r.full_name} (${r.stargazers_count}★, +${s.starsDelta} today, ${r.language || "unknown"}) — ${r.description || "no description"} — topics: ${r.topics.slice(0, 5).join(", ") || "none"}`;
    }).join("\n");

    const response = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: `You are curating a daily AI/ML GitHub digest. From these ${englishCandidates.length} repos, select the 15 most interesting and genuinely AI/ML related ones. Remove repos that:
- Are NOT actually about AI, ML, LLMs, or related technology (e.g., generic web tools, CSS libraries, unrelated dev tools)
- Are low-quality tutorials, awesome-lists, or collection repos with no real code
- Are clearly spam or self-promotion with inflated stars

Return ONLY a JSON array of the selected repo numbers (1-indexed), ordered by how interesting they are for an AI industry professional. Example: [1, 3, 5, 7, ...]

Repos:
${repoList}`,
      }],
    });

    const text = response.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") throw new Error("No text response");

    // Parse the JSON array from response
    const jsonMatch = text.text.match(/\[[\d,\s]+\]/);
    if (!jsonMatch) throw new Error("No JSON array found in response");

    const selectedIndices: number[] = JSON.parse(jsonMatch[0]);
    const filtered = selectedIndices
      .filter((i) => i >= 1 && i <= englishCandidates.length)
      .slice(0, 15)
      .map((i) => englishCandidates[i - 1]);

    console.log(
      `[GitHub] Claude selected ${filtered.length}/${englishCandidates.length} repos: ${filtered.slice(0, 5).map((s) => s.repo.full_name).join(", ")}...`
    );

    return filtered;
  } catch (err) {
    console.error("[GitHub] Claude filter failed, falling back to score-based top 15:", err);
    return englishCandidates.slice(0, 15);
  }
}

// ─── Main Fetch Function ────────────────────────────────────────────

export async function fetchGitHubTrending(
  topics: string[],
  minStars: number
): Promise<GitHubRepo[]> {
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

  // ── Layer 2: Load star cache for delta calculation ──
  const starCache = await loadStarCache();

  // ── API Search: topic + keyword + new + rising queries ──
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

  // Brand new repos getting traction (created in last 7 days, 50+ stars)
  const newRepoQueries = [
    `AI OR LLM OR "machine learning" OR agent created:>${oneWeekAgo} stars:>50`,
    `model OR inference OR transformer OR diffusion created:>${oneWeekAgo} stars:>50`,
  ];

  // Recent repos gaining momentum (created in last 30 days, 200+ stars)
  const risingRepoQueries = [
    `AI OR LLM OR agent OR model created:>${oneMonthAgo} stars:>200`,
  ];

  const allQueries = [...topicQueries, ...keywordQueries, ...newRepoQueries, ...risingRepoQueries];

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

  // ── Compute deltas from star cache ──
  const deltasFromCache = new Map<string, number>();
  for (const [name, repo] of allRepos) {
    const cached = starCache[name];
    if (cached) {
      const delta = repo.stargazers_count - cached.stars;
      if (delta > 0) {
        deltasFromCache.set(name, delta);
      }
    }
    // Update cache with current stars
    starCache[name] = {
      stars: repo.stargazers_count,
      updated_at: new Date().toISOString(),
    };
  }

  // Also add trending repos to cache
  for (const [name, delta] of trendingMap) {
    if (!starCache[name]) {
      starCache[name] = {
        stars: delta, // approximate — we only know delta
        updated_at: new Date().toISOString(),
      };
    }
  }

  // Persist updated cache
  await saveStarCache(starCache);

  if (deltasFromCache.size > 0) {
    console.log(
      `[GitHub] Star cache: ${deltasFromCache.size} repos with delta data`
    );
  }

  // ── Layer 3: Score every repo ──
  const scored: ScoredRepo[] = [];

  for (const [name, repo] of allRepos) {
    // Best available delta: trending page > cache > 0
    const trendingDelta = trendingMap.get(name) || 0;
    const cacheDelta = deltasFromCache.get(name) || 0;
    const starsDelta = Math.max(trendingDelta, cacheDelta);

    const isTrending = trendingMap.has(name);
    const hits = queryHitCount.get(name) || 1;

    scored.push(computeRepoScore(repo, starsDelta, isTrending, hits));
  }

  // Sort by composite score, take top 25 candidates for Claude filtering
  const candidates = scored
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, 25);

  // Logging
  const trendingCount = scored.filter((s) => s.isTrending).length;
  const majorCount = scored.filter((s) => s.orgTier === "major").length;
  console.log(
    `[GitHub] Scored ${scored.length} repos: ${trendingCount} trending, ${majorCount} from major orgs`
  );

  if (candidates.length > 0) {
    console.log(
      `[GitHub] Top candidates: ${candidates.slice(0, 5).map((s) => {
        const ageDays = Math.max(
          (Date.now() - new Date(s.repo.created_at).getTime()) / MS_PER_DAY,
          1
        );
        return `${s.repo.full_name} (${s.repo.stargazers_count}★, delta=${s.starsDelta}, ${Math.round(ageDays)}d, trending=${s.isTrending}, score=${s.finalScore.toFixed(1)})`;
      }).join(", ")}`
    );
  }

  // ── Claude AI-Relevance Filter ──
  // Use Claude to filter out repos that aren't genuinely AI/ML related
  const top = await filterWithClaude(candidates);

  return top.map(({ repo, starsDelta, isTrending, orgTier }) => ({
    name: repo.full_name,
    description: repo.description || "",
    url: repo.html_url,
    stars: repo.stargazers_count,
    stars_delta: starsDelta > 0 ? starsDelta : undefined,
    language: repo.language || "Unknown",
    category: categorizeRepo(repo),
    forks: repo.forks_count,
    is_trending: isTrending || undefined,
    org_tier: orgTier,
  }));
}

