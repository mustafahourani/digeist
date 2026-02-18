import type { HNStory } from "@/lib/types";
import { extractDomain } from "@/lib/utils";

const HN_API = "https://hacker-news.firebaseio.com/v0";
const LOOKBACK_SECONDS = 24 * 60 * 60;

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

function isFromLast48Hours(unixTime: number): boolean {
  const now = Date.now() / 1000;
  return unixTime > now - LOOKBACK_SECONDS;
}

function classifyStoryType(item: HNApiItem, feedSource: string): StoryType {
  if (/^Show HN:/i.test(item.title)) return "show_hn";
  if (/^Ask HN:/i.test(item.title)) return "ask_hn";
  if (feedSource === "new") return "new_riser";
  return "top";
}

// ─── Layer 3: Tiered AI Keywords ────────────────────────────────────

// Tier 1: Definitive AI indicators (full weight)
const AI_KEYWORDS_T1 =
  /\b(llm|large.language.model|openai|anthropic|claude|deepseek|deepmind|chatgpt|gpt-[3-5o]|o[13]-|sonnet|opus|haiku|gemini.\d|grok|rlhf|agi|language.model|foundation.model|diffusion.model|transformer.model|neural.network|deep.learning|machine.learning|fine.tun|generative.ai|multimodal|hugging.face|mistral|meta.ai|llama.\d|qwen|phi-\d|stable.diffusion)/i;

// Tier 2: Probably AI but could be something else (0.6x)
const AI_KEYWORDS_T2 =
  /\b(ai|agent|inference|embedding|vector|rag|gpu|nvidia|cuda|tpu|benchmark|reasoning|alignment|safety|context.window|token|prompt|mcp|model.context.protocol|cursor|windsurf|devin|replit|v0|bolt|coding.agent|vibe.cod|agentic|perplexity|groq|copilot|transformer|reinforcement.learning)/i;

// Tier 3: Weak signals, only count if T1/T2 also present (0.3x)
const AI_KEYWORDS_T3 =
  /\b(model|training|dataset|parameters|weights|latency|throughput|api|scaling|open.source|python|tensor|compute|cloud|quantiz|optimization|distill)/i;

function aiRelevanceScore(title: string): number {
  const t1 = (title.match(new RegExp(AI_KEYWORDS_T1, "gi")) || []).length;
  const t2 = (title.match(new RegExp(AI_KEYWORDS_T2, "gi")) || []).length;
  const t3 = (title.match(new RegExp(AI_KEYWORDS_T3, "gi")) || []).length;

  // T3 only counts if there's at least one T1 or T2 match
  const t3Effective = t1 + t2 > 0 ? t3 : 0;

  const raw = t1 * 1.0 + t2 * 0.6 + t3Effective * 0.3;
  // Normalize to 0-1 with diminishing returns
  return raw === 0 ? 0 : Math.min(1, 0.5 + raw * 0.15);
}

// ─── Discussion Heat ────────────────────────────────────────────────

function discussionHeat(score: number, comments: number): number {
  if (score === 0) return 1;
  const ratio = comments / score;
  const clamped = Math.min(ratio, 2.0);
  // Returns multiplier between 1.0 and 1.5
  return 1 + clamped * 0.25;
}

// ─── Layer 4: Domain Intelligence ───────────────────────────────────

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

// ─── Main Fetch Function ────────────────────────────────────────────

export async function fetchHackerNews(): Promise<HNStory[]> {
  // Layer 1: Fetch all 5 feeds in parallel
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

  // Layer 5: Expanded pool — fetch details for top 250
  const items = await Promise.all(
    allIds.slice(0, 250).map((id) => fetchItem(id))
  );

  const validStories = items.filter((item): item is HNApiItem => {
    if (!item) return false;
    if (item.type !== "story") return false;
    if (!isFromLast48Hours(item.time)) return false;
    return true;
  });

  // Score every story with the composite formula
  const scored = validStories.map((item) => {
    const source = feedSource.get(item.id) || "top";
    const storyType = classifyStoryType(item, source);
    return computeCompositeScore(item, storyType);
  });

  // Sort by composite score, take top 15
  const top = scored
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, 15);

  // Logging
  const aiCount = validStories.filter((s) => aiRelevanceScore(s.title) > 0).length;
  const showCount = scored.filter((s) => s.storyType === "show_hn").length;
  console.log(
    `[HN] ${validStories.length} recent stories from 5 feeds, ${aiCount} AI-related, ${showCount} Show HN`
  );
  if (top.length > 0) {
    const best = top[0];
    console.log(
      `[HN] Top: "${best.item.title}" (score=${best.item.score}, ai=${best.aiRelevance.toFixed(2)}, composite=${best.finalScore.toFixed(1)})`
    );
  }

  return top.map(({ item, storyType, finalScore }) => ({
    id: item.id,
    title: item.title,
    url: item.url || `https://news.ycombinator.com/item?id=${item.id}`,
    score: item.score,
    comments: item.descendants || 0,
    summary: "",
    hn_url: `https://news.ycombinator.com/item?id=${item.id}`,
    story_type: storyType,
    domain: extractDomain(item.url || ""),
    velocity_score: Math.round(finalScore * 10) / 10,
  }));
}

