import Anthropic from "@anthropic-ai/sdk";
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import type { RedditPost } from "@/lib/types";
import { extractDomain } from "@/lib/utils";
import keywords from "@/config/keywords.json";

const REDDIT_BASE = "https://www.reddit.com";
const MS_PER_DAY = 86_400_000;
const USER_AGENT = "Digeist/1.0 (AI digest aggregator)";
const COMMENT_CACHE_PATH = path.join(process.cwd(), "data", "reddit-comment-cache.json");

// ─── Comment Cache ───────────────────────────────────────────────

interface CommentCache {
  [postId: string]: { comments: number; score?: number; updated_at: string };
}

async function loadCommentCache(): Promise<CommentCache> {
  try {
    const raw = await readFile(COMMENT_CACHE_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function saveCommentCache(cache: CommentCache): Promise<void> {
  await mkdir(path.dirname(COMMENT_CACHE_PATH), { recursive: true });
  await writeFile(COMMENT_CACHE_PATH, JSON.stringify(cache, null, 2));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── Reddit API Types ────────────────────────────────────────────

interface RedditApiPost {
  id: string;
  title: string;
  url: string;
  selftext: string;
  score: number;
  num_comments: number;
  created_utc: number;
  author: string;
  subreddit: string;
  domain: string;
  is_self: boolean;
  upvote_ratio: number;
  permalink: string;
  link_flair_text: string | null;
  over_18: boolean;
}

interface RedditListingResponse {
  data: {
    children: { data: RedditApiPost }[];
  };
}

// ─── Layer 1: Multi-Subreddit Ingestion ──────────────────────────

async function fetchSubredditFeed(
  subreddit: string,
  sort: "hot" | "top",
  params?: Record<string, string>
): Promise<RedditApiPost[]> {
  const url = new URL(`${REDDIT_BASE}/r/${subreddit}/${sort}.json`);
  url.searchParams.set("limit", "100");
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }

  try {
    const response = await fetch(url.toString(), {
      headers: { "User-Agent": USER_AGENT },
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.warn(`[Reddit] Rate limited on r/${subreddit}/${sort} — skipping`);
      } else {
        console.error(`[Reddit] r/${subreddit}/${sort} returned ${response.status}`);
      }
      return [];
    }

    const data: RedditListingResponse = await response.json();
    return data.data.children.map((c) => c.data);
  } catch (err) {
    console.error(`[Reddit] Failed to fetch r/${subreddit}/${sort}:`, err);
    return [];
  }
}

async function fetchAllSubreddits(): Promise<Map<string, RedditApiPost>> {
  const subreddits = keywords.reddit.subreddits;
  const allPosts = new Map<string, RedditApiPost>();

  for (const sub of subreddits) {
    // Fetch hot (currently popular) and top/week (best this week)
    const [hot, topWeek] = await Promise.all([
      fetchSubredditFeed(sub, "hot"),
      fetchSubredditFeed(sub, "top", { t: "week" }),
    ]);

    for (const post of [...hot, ...topWeek]) {
      if (post.over_18) continue; // skip NSFW
      const existing = allPosts.get(post.id);
      if (!existing || post.score > existing.score) {
        allPosts.set(post.id, post);
      }
    }

    // Rate limit: wait between subreddits (2 requests per sub, so 1.5s between subs)
    await sleep(1500);
  }

  return allPosts;
}

// ─── Layer 2: Tiered AI Keywords ─────────────────────────────────

const AI_KEYWORDS_T1 =
  /\b(llm|large.language.model|openai|anthropic|claude|deepseek|deepmind|chatgpt|gpt-[3-5o]|o[13]-|sonnet|opus|haiku|gemini.\d|grok|rlhf|agi|language.model|foundation.model|diffusion.model|transformer.model|neural.network|deep.learning|machine.learning|fine.tun|generative.ai|multimodal|hugging.face|mistral|meta.ai|llama.\d|qwen|phi-\d|stable.diffusion)/i;

const AI_KEYWORDS_T2 =
  /\b(ai|agent|inference|embedding|vector|rag|gpu|nvidia|cuda|tpu|benchmark|reasoning|alignment|safety|context.window|token|prompt|mcp|model.context.protocol|cursor|windsurf|devin|replit|v0|bolt|coding.agent|vibe.cod|agentic|perplexity|groq|copilot|transformer|reinforcement.learning)/i;

const AI_KEYWORDS_T3 =
  /\b(model|training|dataset|parameters|weights|latency|throughput|api|scaling|open.source|python|tensor|compute|cloud|quantiz|optimization|distill)/i;

function aiRelevanceScore(title: string, selftext?: string): number {
  const text = selftext ? `${title} ${selftext.slice(0, 500)}` : title;
  const t1 = (text.match(new RegExp(AI_KEYWORDS_T1, "gi")) || []).length;
  const t2 = (text.match(new RegExp(AI_KEYWORDS_T2, "gi")) || []).length;
  const t3 = (text.match(new RegExp(AI_KEYWORDS_T3, "gi")) || []).length;

  const t3Effective = t1 + t2 > 0 ? t3 : 0;
  const raw = t1 * 1.0 + t2 * 0.6 + t3Effective * 0.3;
  return raw === 0 ? 0 : Math.min(1, 0.5 + raw * 0.15);
}

// ─── Layer 3: Subreddit Tier Scoring ─────────────────────────────

const SUBREDDIT_TIER_CORE = new Set([
  "autogpt", "langchain", "localllama",
]);

const SUBREDDIT_TIER_MAJOR = new Set([
  "machinelearning", "openai", "anthropic",
]);

function getSubredditTier(subreddit: string): "core" | "major" | "general" {
  const lower = subreddit.toLowerCase();
  if (SUBREDDIT_TIER_CORE.has(lower)) return "core";
  if (SUBREDDIT_TIER_MAJOR.has(lower)) return "major";
  return "general";
}

function subredditMultiplier(tier: "core" | "major" | "general"): number {
  if (tier === "core") return 1.3;
  if (tier === "major") return 1.1;
  return 1.0;
}

// ─── Layer 4: Domain Intelligence ────────────────────────────────

const AI_DOMAINS_TIER1 = new Set([
  "openai.com", "anthropic.com", "deepmind.google", "ai.meta.com",
  "huggingface.co", "arxiv.org", "mistral.ai", "cohere.com",
  "stability.ai", "perplexity.ai", "blog.google", "ai.google",
  "research.google", "deepseek.com", "together.ai",
]);

const AI_DOMAINS_TIER2 = new Set([
  "github.com", "github.blog", "pytorch.org", "tensorflow.org",
  "nvidia.com", "developer.nvidia.com", "wandb.ai", "modal.com",
  "groq.com", "anyscale.com", "replicate.com",
  "vercel.com", "kaggle.com", "paperswithcode.com",
]);

function getDomainScore(url: string): number {
  try {
    const hostname = new URL(url).hostname.replace("www.", "");
    if (AI_DOMAINS_TIER1.has(hostname)) return 1.2;
    if (AI_DOMAINS_TIER2.has(hostname)) return 1.1;
    const parts = hostname.split(".");
    if (parts.length > 2) {
      const parent = parts.slice(-2).join(".");
      if (AI_DOMAINS_TIER1.has(parent)) return 1.2;
      if (AI_DOMAINS_TIER2.has(parent)) return 1.1;
    }
    return 1.0;
  } catch {
    return 1.0;
  }
}

// ─── Layer 5: Reddit-Specific Signals ────────────────────────────

function upvoteRatioMultiplier(ratio: number): number {
  if (ratio > 0.95) return 1.15;  // Strongly agreed upon
  if (ratio > 0.85) return 1.0;   // Normal
  if (ratio > 0.70) return 0.9;   // Somewhat controversial
  return 0.8;                      // Very controversial or low quality
}

function discussionHeat(score: number, comments: number): number {
  if (score === 0) return 1;
  const ratio = comments / score;
  const clamped = Math.min(ratio, 2.0);
  return 1 + clamped * 0.25;
}

// ─── Layer 6: Composite Multi-Signal Scoring ─────────────────────

interface ScoredPost {
  post: RedditApiPost;
  finalScore: number;
  aiRelevance: number;
}

function computeCompositeScore(post: RedditApiPost): ScoredPost {
  const comments = post.num_comments || 0;

  // Signal 1: Base score (log2 compressed)
  const baseScore = Math.log2(Math.max(post.score, 1));

  // Signal 2: AI relevance (dominant signal)
  const aiRel = aiRelevanceScore(post.title, post.is_self ? post.selftext : undefined);

  // Signal 3: Velocity (score per hour since posting)
  const ageHours = Math.max((Date.now() / 1000 - post.created_utc) / 3600, 0.5);
  const scorePerHour = post.score / ageHours;
  const velocityBonus = Math.min(scorePerHour / 50, 2.0);

  // Signal 4: Discussion heat
  const heat = discussionHeat(post.score, comments);

  // Signal 5: Subreddit tier
  const subTier = subredditMultiplier(getSubredditTier(post.subreddit));

  // Signal 6: Domain trust
  const domainScore = post.is_self ? 1.0 : getDomainScore(post.url);

  // Signal 7: Upvote ratio quality
  const ratioMult = upvoteRatioMultiplier(post.upvote_ratio);

  // AI relevance is the DOMINANT signal (weight 12)
  const finalScore =
    (baseScore * 3 + aiRel * 12 + velocityBonus * 2) *
    heat *
    subTier *
    domainScore *
    ratioMult;

  return { post, finalScore, aiRelevance: aiRel };
}

// ─── Claude Semantic Filter ──────────────────────────────────────

function formatPostForClaude(s: ScoredPost, i: number): string {
  const comments = s.post.num_comments || 0;
  const domain = s.post.is_self ? `self.${s.post.subreddit}` : extractDomain(s.post.url);
  const ageHours = Math.max((Date.now() / 1000 - s.post.created_utc) / 3600, 0.5);
  const ageStr = ageHours < 24
    ? `${Math.round(ageHours)}h ago`
    : `${Math.round(ageHours / 24)}d ago`;
  const flair = s.post.link_flair_text ? ` [${s.post.link_flair_text}]` : "";
  return `${i + 1}. "${s.post.title}" (${s.post.score}pts, ${comments} comments, ${ageStr}, r/${s.post.subreddit}, ${domain})${flair}`;
}

async function filterWithClaude(
  candidates: ScoredPost[],
  columnType: "hot" | "rising",
  client: Anthropic
): Promise<ScoredPost[]> {
  if (candidates.length === 0) return [];
  if (candidates.length <= 10) return candidates;

  const postList = candidates.map((s, i) => formatPostForClaude(s, i)).join("\n");

  const columnPrompt = columnType === "hot"
    ? `You are curating the "Hottest Today" column of a daily AI agents digest. These are Reddit posts from the LAST 24 HOURS across AI-focused subreddits.

From these ${candidates.length} posts, select the top 10 most valuable for an AI practitioner focused on AI agents, tool use, MCP, coding agents, and autonomous AI.

KEEP:
- New tool/project announcements (especially MCP servers, agent frameworks, coding agents)
- Breakthroughs in agent capabilities, benchmarks, or evaluations
- Practical tutorials or deep dives on building with agents
- Model releases relevant to agent use cases
- "I built X with agents" show-and-tell posts with novel applications
- High-discussion posts about agent tooling, workflows, or infrastructure

REMOVE:
- Posts NOT about AI agents, tool use, coding agents, LLMs, or related technology
- Basic beginner questions with no informational value
- Memes, jokes, or low-effort content
- Duplicate coverage of the same announcement
- Pure speculation without substance`

    : `You are curating the "Hottest This Week" column of a daily AI agents digest. These are Reddit posts from the PAST 2-7 DAYS that generated significant discussion.

From these ${candidates.length} posts, select the top 10 most valuable for an AI practitioner focused on AI agents, tool use, MCP, coding agents, and autonomous AI.

KEEP:
- Posts that had lasting impact — still being discussed days later
- Major tool launches, model releases, or framework updates relevant to agents
- Deep technical posts about agent architectures, MCP, tool use patterns
- Posts with high comment-to-score ratio (active discussion = community signal)
- Community discoveries — "this tool/approach actually works in production"

REMOVE:
- Posts NOT about AI agents, tool use, coding agents, LLMs, or related technology
- Ephemeral news that's already stale
- Duplicate coverage of the same event
- Low-quality opinion pieces or speculation`;

  try {
    console.log(`[Reddit] Claude filter (${columnType}): analyzing ${candidates.length} candidates...`);

    const response = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: `${columnPrompt}

Return ONLY a JSON array of the selected post numbers (1-indexed), ordered by value — most interesting first.
Example: [1, 3, 5, 7, ...]

Posts:
${postList}`,
      }],
    });

    const text = response.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") throw new Error("No text response");

    const jsonMatch = text.text.match(/\[[\d,\s]+\]/);
    if (!jsonMatch) throw new Error("No JSON array found in response");

    const selectedIndices: number[] = JSON.parse(jsonMatch[0]);
    const selected = selectedIndices
      .filter((i) => i >= 1 && i <= candidates.length)
      .slice(0, 10)
      .map((i) => candidates[i - 1]);

    console.log(
      `[Reddit] Claude (${columnType}): selected ${selected.length}/${candidates.length} — "${selected[0]?.post.title?.slice(0, 50)}..."`,
    );

    return selected;
  } catch (err) {
    console.error(`[Reddit] Claude filter (${columnType}) failed, using score-based fallback:`, err);
    return candidates.slice(0, 10);
  }
}

// ─── Main Fetch Function ─────────────────────────────────────────

export async function fetchReddit(): Promise<{
  hot_posts: RedditPost[];
  rising_posts: RedditPost[];
}> {
  const client = new Anthropic();

  // Layer 1: Fetch from all subreddits
  console.log("[Reddit] Fetching from subreddits...");
  const allPosts = await fetchAllSubreddits();
  console.log(`[Reddit] Found ${allPosts.size} unique posts across ${keywords.reddit.subreddits.length} subreddits`);

  // Score every post
  const scored = [...allPosts.values()]
    .filter((p) => p.score >= keywords.reddit.min_score)
    .map((p) => computeCompositeScore(p));

  // Split into hot (<24h) vs rising (1-7d)
  const now = Date.now() / 1000;
  const oneDayAgo = now - MS_PER_DAY / 1000;
  const oneWeekAgo = now - 7 * MS_PER_DAY / 1000;

  const hotCandidates: ScoredPost[] = [];
  const risingCandidates: ScoredPost[] = [];

  for (const post of scored) {
    if (post.post.created_utc > oneDayAgo) {
      hotCandidates.push(post);
    } else if (post.post.created_utc > oneWeekAgo && post.post.score >= 30) {
      risingCandidates.push(post);
    }
  }

  hotCandidates.sort((a, b) => b.finalScore - a.finalScore);
  risingCandidates.sort((a, b) => b.finalScore - a.finalScore);

  console.log(`[Reddit] Split: ${hotCandidates.length} hot (<24h), ${risingCandidates.length} rising (1-7d)`);

  // Claude semantic filter
  const [hotFiltered, risingFiltered] = await Promise.all([
    filterWithClaude(hotCandidates.slice(0, 30), "hot", client),
    filterWithClaude(risingCandidates.slice(0, 30), "rising", client),
  ]);

  // ── Comment delta cache ──
  const commentCache = await loadCommentCache();
  const STALE_MS = 36 * 60 * 60 * 1000; // 36h
  const commentDeltas = new Map<string, number>();
  const scoreDeltas = new Map<string, number>();

  // Compute deltas for all fetched posts
  for (const [id, post] of allPosts) {
    const cached = commentCache[id];
    const comments = post.num_comments || 0;
    const score = post.score;
    if (cached) {
      const cacheAge = Date.now() - new Date(cached.updated_at).getTime();
      if (cacheAge <= STALE_MS) {
        const cDelta = comments - cached.comments;
        if (cDelta > 0) commentDeltas.set(id, cDelta);
        if (cached.score != null) {
          const sDelta = score - cached.score;
          if (sDelta > 0) scoreDeltas.set(id, sDelta);
        }
      }
    }
    // Update cache
    commentCache[id] = {
      comments,
      score,
      updated_at: new Date().toISOString(),
    };
  }

  await saveCommentCache(commentCache);

  function toRedditPost(s: ScoredPost): RedditPost {
    const comments = s.post.num_comments || 0;
    const commentsDelta = commentDeltas.get(s.post.id);
    const scoreDelta = scoreDeltas.get(s.post.id);
    return {
      id: s.post.id,
      title: s.post.title,
      url: s.post.is_self
        ? `${REDDIT_BASE}${s.post.permalink}`
        : s.post.url,
      score: s.post.score,
      comments,
      summary: "",
      reddit_url: `${REDDIT_BASE}${s.post.permalink}`,
      subreddit: s.post.subreddit,
      author: s.post.author,
      domain: s.post.is_self ? `self.${s.post.subreddit}` : s.post.domain,
      is_self: s.post.is_self,
      upvote_ratio: s.post.upvote_ratio,
      post_type: s.post.is_self ? "self" : "link",
      velocity_score: Math.round(s.finalScore * 10) / 10,
      score_delta: scoreDelta,
      comments_delta: commentsDelta,
      created_at: new Date(s.post.created_utc * 1000).toISOString(),
      flair: s.post.link_flair_text || undefined,
    };
  }

  const hot_posts = hotFiltered.slice(0, 10).map(toRedditPost);
  const rising_posts = risingFiltered.slice(0, 10).map(toRedditPost);

  console.log(`[Reddit] Final: ${hot_posts.length} hot, ${rising_posts.length} rising`);

  return { hot_posts, rising_posts };
}
