import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import type { Tweet } from "./types";

const STATS_PATH = path.join(process.cwd(), "data", "author-discovery.json");
const KEYWORDS_PATH = path.join(process.cwd(), "config", "keywords.json");

// Auto-promote after appearing on 3+ different days AND having AI-relevant tweets
const PROMOTE_AFTER_DAYS = 3;
const PROMOTE_AFTER_ENGAGEMENT = 10000;

// AI relevance filter — at least one tweet from the author must match
const AI_RELEVANCE_PATTERN =
  /\b(ai|llm|gpt|claude|openai|anthropic|deepseek|deepmind|mistral|gemini|model|inference|training|neural|transformer|diffusion|machine.learning|deep.learning|fine.tun|rag|embedding|vector|agent|prompt|token|gpu|nvidia|cuda|rlhf|alignment|multimodal|hugging.face|langchain|cursor|copilot|mcp|vibe.cod|agentic|foundation.model|language.model|chatgpt|perplexity|groq|llama|qwen|phi-\d|stable.diffusion|generative|reinforcement|computer.vision)\b/i;

// Crypto AI relevance for that section
const CRYPTO_AI_RELEVANCE_PATTERN =
  /\b(depin|decentralized.ai|on.?chain.ai|ai.agent|crypto.ai|web3.ai|bittensor|tao|subnet|defai|ai.token|gpu.network|inference|compute.network|eliza|virtuals|ritual|gensyn|allora|vana|sentient|nillion|morpheus|render|akash|fetch\.ai|singularitynet|ocean.protocol|ai16z)\b/i;

interface AuthorStat {
  name: string;
  appearances: number;
  total_engagement: number;
  ai_tweet_count: number;
  first_seen: string;
  last_seen: string;
  promoted: boolean;
}

interface DiscoveryData {
  ai_twitter: Record<string, AuthorStat>;
  crypto_ai_twitter: Record<string, AuthorStat>;
}

async function loadStats(): Promise<DiscoveryData> {
  try {
    const raw = await readFile(STATS_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return { ai_twitter: {}, crypto_ai_twitter: {} };
  }
}

async function saveStats(data: DiscoveryData): Promise<void> {
  await mkdir(path.dirname(STATS_PATH), { recursive: true });
  await writeFile(STATS_PATH, JSON.stringify(data, null, 2));
}

function isAIRelevant(text: string, section: "ai_twitter" | "crypto_ai_twitter"): boolean {
  if (AI_RELEVANCE_PATTERN.test(text)) return true;
  if (section === "crypto_ai_twitter" && CRYPTO_AI_RELEVANCE_PATTERN.test(text)) return true;
  return false;
}

export async function runDiscovery(
  tweets: Tweet[],
  section: "ai_twitter" | "crypto_ai_twitter"
): Promise<string[]> {
  const allStats = await loadStats();
  const sectionStats = allStats[section];

  let keywords: Record<string, { accounts: string[]; [k: string]: unknown }>;
  try {
    keywords = JSON.parse(await readFile(KEYWORDS_PATH, "utf-8"));
  } catch {
    return [];
  }

  const existingAccounts = new Set(
    (keywords[section]?.accounts || []).map((a) => a.toLowerCase())
  );

  const today = new Date().toISOString().split("T")[0];
  const promoted: string[] = [];

  // Aggregate engagement by author (skip accounts we already track)
  // Only count AI-relevant tweets toward promotion
  const authorMap = new Map<
    string,
    { name: string; totalEng: number; aiTweetCount: number }
  >();

  for (const tweet of tweets) {
    const handle = tweet.author_handle.replace("@", "").toLowerCase();
    if (handle === "unknown" || existingAccounts.has(handle)) continue;

    const eng = tweet.likes + tweet.retweets + tweet.quotes;
    const aiRelevant = isAIRelevant(tweet.text, section);

    const existing = authorMap.get(handle);
    if (existing) {
      existing.totalEng += eng;
      if (aiRelevant) existing.aiTweetCount++;
    } else {
      authorMap.set(handle, {
        name: tweet.author_name,
        totalEng: eng,
        aiTweetCount: aiRelevant ? 1 : 0,
      });
    }
  }

  // Update stats for each discovered author
  for (const [handle, { name, totalEng, aiTweetCount }] of authorMap) {
    const stat: AuthorStat = sectionStats[handle] || {
      name,
      appearances: 0,
      total_engagement: 0,
      ai_tweet_count: 0,
      first_seen: today,
      last_seen: "",
      promoted: false,
    };

    // Count as new appearance only if it's a new day (handles re-runs)
    if (stat.last_seen !== today) {
      stat.appearances++;
      stat.last_seen = today;
    }
    stat.total_engagement += totalEng;
    stat.ai_tweet_count = (stat.ai_tweet_count || 0) + aiTweetCount;
    stat.name = name;
    sectionStats[handle] = stat;

    // Check promotion thresholds:
    // Must have at least 2 AI-relevant tweets AND meet engagement/appearance threshold
    if (
      !stat.promoted &&
      stat.ai_tweet_count >= 2 &&
      (stat.appearances >= PROMOTE_AFTER_DAYS ||
        stat.total_engagement >= PROMOTE_AFTER_ENGAGEMENT)
    ) {
      stat.promoted = true;
      promoted.push(handle);
      console.log(
        `[Discovery] Auto-promoting @${handle} (${name}) — ` +
          `${stat.appearances} day(s), ${stat.total_engagement.toLocaleString()} engagement, ${stat.ai_tweet_count} AI tweets`
      );
    }
  }

  allStats[section] = sectionStats;
  await saveStats(allStats);

  // Auto-add promoted accounts to keywords.json
  if (promoted.length > 0) {
    keywords[section].accounts.push(...promoted);
    await writeFile(KEYWORDS_PATH, JSON.stringify(keywords, null, 2));
    console.log(
      `[Discovery] Added ${promoted.length} account(s) to ${section}: ${promoted.join(", ")}`
    );
  }

  return promoted;
}
