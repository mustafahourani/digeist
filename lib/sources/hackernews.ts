import Anthropic from "@anthropic-ai/sdk";
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import type { HNStory } from "@/lib/types";
import { extractDomain } from "@/lib/utils";
import { aiRelevanceScore, discussionHeat, MS_PER_DAY } from "@/lib/scoring";

const HN_API = "https://hacker-news.firebaseio.com/v0";
const HN_ALGOLIA = "https://hn.algolia.com/api/v1";
const COMMENT_CACHE_PATH = path.join(process.cwd(), "data", "hn-comment-cache.json");

// ─── Comment Cache ───────────────────────────────────────────────

interface CommentCache {
  [storyId: string]: { comments: number; score?: number; updated_at: string };
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

interface HNApiItem {
  id: number;
  title: string;
  url?: string;
  score: number;
  descendants?: number;
  time: number;
  by: string;
  type: string;
}

type StoryType = "top" | "show_hn" | "ask_hn" | "new_riser";

// ─── Layer 1: Multi-Feed Ingestion ──────────────────────────────────

async function fetchFeed(endpoint: string): Promise<number[]> {
  try {
    const response = await fetch(`${HN_API}/${endpoint}.json`);
    if (!response.ok) return [];
    return response.json();
  } catch {
    return [];
  }
}

async function fetchItem(id: number): Promise<HNApiItem | null> {
  try {
    const response = await fetch(`${HN_API}/item/${id}.json`);
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

function classifyStoryType(item: HNApiItem, feedSource: string): StoryType {
  if (/^Show HN:/i.test(item.title)) return "show_hn";
  if (/^Ask HN:/i.test(item.title)) return "ask_hn";
  if (feedSource === "new") return "new_riser";
  return "top";
}

// ─── Algolia HN Search ──────────────────────────────────────────────
// Searches for AI-related stories from the past week that may have
// dropped off Firebase's live feeds (top/best/etc.)

interface AlgoliaHit {
  objectID: string;
  title: string;
  url: string | null;
  points: number;
  num_comments: number;
  created_at_i: number;
  author: string;
}

async function searchAlgolia(query: string, minPoints: number, afterTimestamp: number): Promise<HNApiItem[]> {
  try {
    const params = new URLSearchParams({
      query,
      tags: "story",
      numericFilters: `points>${minPoints},created_at_i>${afterTimestamp}`,
      hitsPerPage: "50",
    });
    const response = await fetch(`${HN_ALGOLIA}/search?${params}`);
    if (!response.ok) return [];
    const data = await response.json();
    return (data.hits || []).map((hit: AlgoliaHit) => ({
      id: parseInt(hit.objectID, 10),
      title: hit.title,
      url: hit.url || undefined,
      score: hit.points,
      descendants: hit.num_comments,
      time: hit.created_at_i,
      by: hit.author,
      type: "story",
    }));
  } catch {
    return [];
  }
}

// ─── Layer 3: Domain Intelligence ───────────────────────────────────

const AI_DOMAINS_TIER1 = new Set([
  "openai.com", "anthropic.com", "deepmind.google", "ai.meta.com",
  "huggingface.co", "arxiv.org", "mistral.ai", "cohere.com",
  "stability.ai", "perplexity.ai", "blog.google", "ai.google",
  "research.google", "deepseek.com", "together.ai",
]);

const AI_DOMAINS_TIER2 = new Set([
  "github.com", "github.blog", "pytorch.org", "tensorflow.org",
  "nvidia.com", "developer.nvidia.com", "wandb.ai", "modal.com",
  "groq.com", "anyscale.com", "replicate.com", "fly.io",
  "vercel.com", "kaggle.com", "paperswithcode.com",
]);

function getDomainScore(url: string): number {
  try {
    const hostname = new URL(url).hostname.replace("www.", "");
    if (AI_DOMAINS_TIER1.has(hostname)) return 1.2;
    if (AI_DOMAINS_TIER2.has(hostname)) return 1.1;
    // Check parent domain (e.g., blog.openai.com → openai.com)
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

// ─── Layer 2: Composite Multi-Signal Scoring ────────────────────────

interface ScoredStory {
  item: HNApiItem;
  storyType: StoryType;
  finalScore: number;
  aiRelevance: number;
}

function computeCompositeScore(
  item: HNApiItem,
  storyType: StoryType
): ScoredStory {
  const comments = item.descendants || 0;
  const url = item.url || "";

  // Signal 1: Base score (log2 compressed)
  // 100pts → 6.6, 400pts → 8.6, 900pts → 9.8
  const baseScore = Math.log2(Math.max(item.score, 1));

  // Signal 2: AI relevance (0-1 scale, dominant signal)
  const aiRel = aiRelevanceScore(item.title);

  // Signal 3: Velocity (points per hour since posting)
  const ageHours = Math.max((Date.now() / 1000 - item.time) / 3600, 0.5);
  const pointsPerHour = item.score / ageHours;
  const velocityBonus = Math.min(pointsPerHour / 50, 2.0);

  // Signal 4: Discussion heat multiplier
  const heat = discussionHeat(item.score, comments);

  // Signal 5: Show HN bonus
  const showHnBonus = storyType === "show_hn" ? 1.3 : 1.0;

  // Signal 6: Domain trust multiplier
  const domainScore = getDomainScore(url);

  // AI relevance is the DOMINANT signal (weight 12)
  // Base score provides a floor (weight 3)
  // Velocity rewards fast risers (weight 2)
  const finalScore =
    (baseScore * 3 + aiRel * 12 + velocityBonus * 2) *
    heat *
    showHnBonus *
    domainScore;

  return { item, storyType, finalScore, aiRelevance: aiRel };
}

// ─── Claude Semantic Filter ─────────────────────────────────────────
// Like GitHub's filterColumnWithClaude — Claude picks the best stories
// from the scored candidates, understanding context that regex can't.

function formatStoryForClaude(s: ScoredStory, i: number): string {
  const comments = s.item.descendants || 0;
  const domain = s.item.url ? extractDomain(s.item.url) : "self";
  const ageHours = Math.max((Date.now() / 1000 - s.item.time) / 3600, 0.5);
  const ageStr = ageHours < 24
    ? `${Math.round(ageHours)}h ago`
    : `${Math.round(ageHours / 24)}d ago`;
  return `${i + 1}. "${s.item.title}" (${s.item.score}pts, ${comments} comments, ${ageStr}, ${domain}) [${s.storyType}]`;
}

async function filterWithClaude(
  candidates: ScoredStory[],
  columnType: "hot" | "rising",
  client: Anthropic
): Promise<ScoredStory[]> {
  if (candidates.length === 0) return [];
  if (candidates.length <= 10) return candidates;

  const storyList = candidates.map((s, i) => formatStoryForClaude(s, i)).join("\n");

  const columnPrompt = columnType === "hot"
    ? `You are curating the "Hottest Today" column of a daily AI digest. These are Hacker News stories from the LAST 24 HOURS.

From these ${candidates.length} stories, select the top 10 most valuable for an AI practitioner.

KEEP:
- Major announcements from AI companies (OpenAI, Anthropic, Google, Meta, etc.) — these ARE the news
- New tools, frameworks, and products people are building with AI
- Show HN posts with novel AI applications
- Research breakthroughs, benchmarks, and model releases
- Infrastructure, deployment, and scaling stories relevant to AI practitioners
- Developer experience stories (using AI tools, coding agents, etc.)

REMOVE:
- Stories NOT related to AI, ML, LLMs, agents, or tech that AI practitioners care about
- Pure opinion/editorial pieces with no technical substance
- Duplicate coverage of the same event (keep the highest-scoring one)
- Clickbait or rage-bait titles with no actionable information`

    : `You are curating the "Hottest This Week" column of a daily AI digest. These are Hacker News stories from the PAST 2-7 DAYS that are still generating discussion.

From these ${candidates.length} stories, select the top 10 most valuable for an AI practitioner.

KEEP:
- Stories that had lasting impact — still being discussed days later
- Major product launches, model releases, or industry shifts
- Deep technical posts (blog posts, papers) that aged well
- Show HN posts that gained real traction
- Important policy, regulation, or business developments affecting AI

REMOVE:
- Stories NOT related to AI, ML, LLMs, agents, or tech that AI practitioners care about
- Ephemeral news that's already stale
- Duplicate coverage of the same event
- Low-quality opinion pieces`;

  try {
    console.log(`[HN] Claude filter (${columnType}): analyzing ${candidates.length} candidates...`);

    const response = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: `${columnPrompt}

Return ONLY a JSON array of the selected story numbers (1-indexed), ordered by importance — most valuable first.
Example: [1, 3, 5, 7, ...]

Stories:
${storyList}`,
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
      `[HN] Claude (${columnType}): selected ${selected.length}/${candidates.length} — "${selected[0]?.item.title?.slice(0, 50)}..."`,
    );

    return selected;
  } catch (err) {
    console.error(`[HN] Claude filter (${columnType}) failed, using score-based fallback:`, err);
    return candidates.slice(0, 10);
  }
}

// ─── Main Fetch Function ────────────────────────────────────────────

export async function fetchHackerNews(): Promise<{ hot_stories: HNStory[]; rising_stories: HNStory[] }> {
  const client = new Anthropic();

  // ── Layer 1: Fetch Firebase feeds (captures what's active NOW) ──
  const [topIds, bestIds, showIds, newIds, askIds] = await Promise.all([
    fetchFeed("topstories"),
    fetchFeed("beststories"),
    fetchFeed("showstories"),
    fetchFeed("newstories"),
    fetchFeed("askstories"),
  ]);

  // Track which feed each ID came from (for classification)
  const feedSource = new Map<number, string>();
  for (const id of topIds) feedSource.set(id, "top");
  for (const id of bestIds) if (!feedSource.has(id)) feedSource.set(id, "best");
  for (const id of showIds) feedSource.set(id, "show"); // Show HN takes priority
  for (const id of askIds) feedSource.set(id, "ask");
  for (const id of newIds) if (!feedSource.has(id)) feedSource.set(id, "new");

  // Merge and deduplicate
  const seen = new Set<number>();
  const allIds: number[] = [];
  for (const id of [...topIds, ...bestIds, ...showIds, ...askIds, ...newIds]) {
    if (!seen.has(id)) {
      seen.add(id);
      allIds.push(id);
    }
  }

  // ── Layer 1b: Algolia search for AI stories from past week ──
  // Firebase feeds only show currently active stories; Algolia catches
  // AI stories from days ago that dropped off the front page
  const oneWeekAgo = Math.floor((Date.now() - 7 * MS_PER_DAY) / 1000);
  const algoliaQueries = [
    "LLM OR \"language model\" OR OpenAI OR Anthropic OR Claude",
    "AI agent OR coding agent OR MCP OR \"model context protocol\"",
    "GPT OR Gemini OR DeepSeek OR Llama",
  ];

  console.log("[HN] Fetching Firebase feeds + Algolia AI searches...");
  const algoliaResults = await Promise.all(
    algoliaQueries.map((q) => searchAlgolia(q, 50, oneWeekAgo))
  );

  // Add Algolia results to the pool (deduplicated)
  const algoliaItems: HNApiItem[] = [];
  for (const results of algoliaResults) {
    for (const item of results) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        algoliaItems.push(item);
        if (!feedSource.has(item.id)) feedSource.set(item.id, "top");
      }
    }
  }

  // Fetch details for Firebase items (Algolia items already have details)
  const firebaseItems = await Promise.all(
    allIds.slice(0, 300).map((id) => fetchItem(id))
  );

  const now = Date.now() / 1000;
  const oneDayAgo = now - MS_PER_DAY / 1000;
  const oneWeekAgoUnix = now - 7 * MS_PER_DAY / 1000;

  // Combine all items, filter to last 7 days
  const allItems = [
    ...firebaseItems.filter((item): item is HNApiItem => item != null && item.type === "story"),
    ...algoliaItems,
  ].filter((item) => item.time > oneWeekAgoUnix);

  // Deduplicate by id (Algolia items may overlap with Firebase)
  const deduped = new Map<number, HNApiItem>();
  for (const item of allItems) {
    const existing = deduped.get(item.id);
    // Prefer Firebase item (more accurate score) over Algolia
    if (!existing || (item.score > existing.score)) {
      deduped.set(item.id, item);
    }
  }

  const validStories = [...deduped.values()];

  // ── Score every story ──
  const scored = validStories.map((item) => {
    const source = feedSource.get(item.id) || "top";
    const storyType = classifyStoryType(item, source);
    return computeCompositeScore(item, storyType);
  });

  // ── Split into hot (last 24h) vs rising (1-7 days) ──
  const hotCandidates: ScoredStory[] = [];
  const risingCandidates: ScoredStory[] = [];

  for (const story of scored) {
    if (story.item.time > oneDayAgo) {
      hotCandidates.push(story);
    } else {
      // Only include rising stories with decent traction
      if (story.item.score >= 30) {
        risingCandidates.push(story);
      }
    }
  }

  // Sort each bucket by composite score
  hotCandidates.sort((a, b) => b.finalScore - a.finalScore);
  risingCandidates.sort((a, b) => b.finalScore - a.finalScore);

  // Logging
  const aiCount = validStories.filter((s) => aiRelevanceScore(s.title) > 0).length;
  const showCount = scored.filter((s) => s.storyType === "show_hn").length;
  console.log(
    `[HN] ${validStories.length} stories from 5 feeds + Algolia, ${aiCount} AI-related, ${showCount} Show HN`
  );
  console.log(
    `[HN] Split: ${hotCandidates.length} hot (<24h), ${risingCandidates.length} rising (1-7d)`
  );

  // ── Claude semantic filter — pick best from each column ──
  const [hotFiltered, risingFiltered] = await Promise.all([
    filterWithClaude(hotCandidates.slice(0, 30), "hot", client),
    filterWithClaude(risingCandidates.slice(0, 30), "rising", client),
  ]);

  // ── Comment delta cache ──
  const commentCache = await loadCommentCache();
  const STALE_MS = 36 * 60 * 60 * 1000; // 36h
  const commentDeltas = new Map<number, number>();
  const scoreDeltas = new Map<number, number>();

  // Compute deltas for all valid stories (not just final selection)
  for (const item of validStories) {
    const cached = commentCache[String(item.id)];
    const comments = item.descendants || 0;
    const score = item.score;
    if (cached) {
      const cacheAge = Date.now() - new Date(cached.updated_at).getTime();
      if (cacheAge <= STALE_MS) {
        const cDelta = comments - cached.comments;
        if (cDelta > 0) commentDeltas.set(item.id, cDelta);
        if (cached.score != null) {
          const sDelta = score - cached.score;
          if (sDelta > 0) scoreDeltas.set(item.id, sDelta);
        }
      }
    }
    // Update cache
    commentCache[String(item.id)] = {
      comments,
      score,
      updated_at: new Date().toISOString(),
    };
  }

  await saveCommentCache(commentCache);

  function toHNStory(s: ScoredStory): HNStory {
    const comments = s.item.descendants || 0;
    const commentsDelta = commentDeltas.get(s.item.id);
    const scoreDelta = scoreDeltas.get(s.item.id);
    return {
      id: s.item.id,
      title: s.item.title,
      url: s.item.url || `https://news.ycombinator.com/item?id=${s.item.id}`,
      score: s.item.score,
      comments,
      summary: "",
      hn_url: `https://news.ycombinator.com/item?id=${s.item.id}`,
      story_type: s.storyType,
      domain: extractDomain(s.item.url || ""),
      velocity_score: Math.round(s.finalScore * 10) / 10,
      score_delta: scoreDelta,
      comments_delta: commentsDelta,
      created_at: new Date(s.item.time * 1000).toISOString(),
    };
  }

  const hot_stories = hotFiltered.slice(0, 10).map(toHNStory);
  const rising_stories = risingFiltered.slice(0, 10).map(toHNStory);

  console.log(`[HN] Final: ${hot_stories.length} hot, ${rising_stories.length} rising`);

  return { hot_stories, rising_stories };
}
