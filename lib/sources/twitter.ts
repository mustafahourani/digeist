import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import type { Tweet } from "@/lib/types";

const X_API_BASE = "https://api.x.com/2";
const CACHE_PATH = path.join(process.cwd(), "data", "account-cache.json");
const LOOKBACK_MS = 24 * 60 * 60 * 1000;

interface AccountCache {
  [username: string]: { id: string; name: string; updated_at: string };
}

async function loadCache(): Promise<AccountCache> {
  try {
    const raw = await readFile(CACHE_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function saveCache(cache: AccountCache): Promise<void> {
  await mkdir(path.dirname(CACHE_PATH), { recursive: true });
  await writeFile(CACHE_PATH, JSON.stringify(cache, null, 2));
}

interface XApiTweet {
  id: string;
  text: string;
  created_at: string;
  public_metrics: {
    like_count: number;
    retweet_count: number;
    quote_count: number;
    reply_count: number;
    impression_count: number;
  };
  author_id: string;
  entities?: {
    urls?: { expanded_url: string }[];
  };
}

interface XApiUser {
  id: string;
  name: string;
  username: string;
  profile_image_url?: string;
}

interface XSearchResponse {
  data?: XApiTweet[];
  includes?: {
    users?: XApiUser[];
  };
  meta?: {
    result_count: number;
    next_token?: string;
  };
}

function getToken(): string {
  const token = process.env.X_API_BEARER_TOKEN;
  if (!token) throw new Error("X_API_BEARER_TOKEN not set");
  return token;
}

async function searchTweets(
  query: string,
  maxResults: number = 50,
): Promise<{ tweets: XApiTweet[]; users: XApiUser[] }> {
  // min_faves is a premium operator not available on Basic/Pro tier,
  // so we filter by likes client-side after fetching
  const fullQuery = `${query} -is:retweet lang:en`;

  // Only fetch tweets from the last 48 hours for a daily digest
  const twoDaysAgo = new Date(Date.now() - LOOKBACK_MS);
  const startTime = twoDaysAgo.toISOString();

  const allTweets: XApiTweet[] = [];
  const allUsers: XApiUser[] = [];
  let nextToken: string | undefined;
  const maxPages = Math.ceil(maxResults / 100); // paginate to fill maxResults

  for (let page = 0; page < maxPages; page++) {
    const params = new URLSearchParams({
      query: fullQuery,
      max_results: String(Math.min(maxResults - allTweets.length, 100)),
      start_time: startTime,
      "tweet.fields": "created_at,public_metrics,author_id,entities",
      expansions: "author_id",
      "user.fields": "name,username,profile_image_url",
      sort_order: "relevancy",
    });
    if (nextToken) {
      params.set("next_token", nextToken);
    }

    const response = await fetch(`${X_API_BASE}/tweets/search/recent?${params}`, {
      headers: {
        Authorization: `Bearer ${getToken()}`,
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`X API error ${response.status}: ${body}`);
    }

    const data: XSearchResponse = await response.json();
    if (data.data) allTweets.push(...data.data);
    if (data.includes?.users) allUsers.push(...data.includes.users);

    // Stop if no more pages or we've collected enough
    nextToken = data.meta?.next_token;
    if (!nextToken || allTweets.length >= maxResults) break;
  }

  return { tweets: allTweets, users: allUsers };
}

async function resolveUsernames(usernames: string[]): Promise<XApiUser[]> {
  const cache = await loadCache();
  const users: XApiUser[] = [];
  const resolvedNames = new Set<string>();

  // X API allows up to 100 usernames per request
  for (let i = 0; i < usernames.length; i += 100) {
    const batch = usernames.slice(i, i + 100);
    const params = new URLSearchParams({
      usernames: batch.join(","),
      "user.fields": "name,username,profile_image_url",
    });

    try {
      const response = await fetch(`${X_API_BASE}/users/by?${params}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });

      if (!response.ok) {
        const body = await response.text();
        console.error(`[Twitter] User lookup failed: ${response.status} ${body}`);
        continue;
      }

      const data = await response.json();
      if (data.data) {
        for (const user of data.data) {
          users.push(user);
          resolvedNames.add(user.username.toLowerCase());
          // Update cache with current username → ID mapping
          cache[user.username.toLowerCase()] = {
            id: user.id,
            name: user.name,
            updated_at: new Date().toISOString(),
          };
        }
      }
    } catch (err) {
      console.error("[Twitter] User lookup request failed:", err);
    }
  }

  // Fall back to cached IDs for any usernames that failed to resolve (renamed accounts)
  for (const username of usernames) {
    const key = username.toLowerCase();
    if (!resolvedNames.has(key) && cache[key]) {
      console.log(`[Twitter] @${username} not found — using cached ID ${cache[key].id} (${cache[key].name})`);
      users.push({
        id: cache[key].id,
        name: cache[key].name,
        username,
        profile_image_url: undefined,
      });
    }
  }

  // Persist updated cache
  await saveCache(cache);

  return users;
}

async function fetchUserTimeline(
  userId: string,
  startTime: string
): Promise<{ tweets: XApiTweet[]; users: XApiUser[] }> {
  const params = new URLSearchParams({
    max_results: "100",
    start_time: startTime,
    exclude: "replies,retweets",
    "tweet.fields": "created_at,public_metrics,author_id,entities",
    expansions: "author_id",
    "user.fields": "name,username,profile_image_url",
  });

  const response = await fetch(`${X_API_BASE}/users/${userId}/tweets?${params}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Timeline error ${response.status}: ${body}`);
  }

  const data: XSearchResponse = await response.json();
  return {
    tweets: data.data || [],
    users: data.includes?.users || [],
  };
}

function buildTweet(apiTweet: XApiTweet, users: XApiUser[]): Tweet {
  const user = users.find((u) => u.id === apiTweet.author_id);
  return {
    id: apiTweet.id,
    author_handle: user ? `@${user.username}` : "@unknown",
    author_name: user?.name || "Unknown",
    author_avatar: user?.profile_image_url,
    text: apiTweet.text,
    likes: apiTweet.public_metrics.like_count,
    retweets: apiTweet.public_metrics.retweet_count,
    quotes: apiTweet.public_metrics.quote_count,
    views: apiTweet.public_metrics.impression_count || 0,
    url: `https://x.com/${user?.username || "i"}/status/${apiTweet.id}`,
    created_at: apiTweet.created_at,
  };
}

function totalEngagement(tweet: Tweet): number {
  return tweet.views || (tweet.likes + tweet.retweets + tweet.quotes);
}

// Common words to ignore when discovering trending terms
const STOP_WORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "shall", "can", "need", "dare", "ought",
  "used", "to", "of", "in", "for", "on", "with", "at", "by", "from",
  "as", "into", "through", "during", "before", "after", "above", "below",
  "between", "out", "off", "over", "under", "again", "further", "then",
  "once", "here", "there", "when", "where", "why", "how", "all", "each",
  "every", "both", "few", "more", "most", "other", "some", "such", "no",
  "nor", "not", "only", "own", "same", "so", "than", "too", "very",
  "just", "don", "now", "also", "new", "like", "get", "got", "much",
  "this", "that", "these", "those", "i", "me", "my", "we", "our", "you",
  "your", "he", "him", "his", "she", "her", "it", "its", "they", "them",
  "their", "what", "which", "who", "whom", "about", "up", "if", "or",
  "and", "but", "because", "until", "while", "yet", "still", "even",
  "going", "one", "two", "think", "know", "see", "make", "want", "say",
  "said", "says", "really", "right", "way", "thing", "things", "people",
  "time", "first", "last", "long", "great", "big", "come", "take",
  "use", "using", "used", "work", "working", "look", "looking", "well",
  "back", "good", "best", "better", "day", "days", "year", "years",
  "via", "amp", "https", "http", "com", "www", "rt",
]);

// Known existing search terms to avoid re-searching
function extractExistingTerms(queries: string[]): Set<string> {
  const terms = new Set<string>();
  for (const q of queries) {
    // Extract quoted phrases and OR-separated terms
    const parts = q.split(/\s+OR\s+/i);
    for (const part of parts) {
      const cleaned = part.replace(/[""]/g, "").trim().toLowerCase();
      if (cleaned) terms.add(cleaned);
    }
  }
  return terms;
}

// AI context check — only extract trending terms from tweets that are actually about AI/tech
const AI_CONTEXT_PATTERN =
  /\b(ai|llm|gpt|model|openai|anthropic|claude|deepseek|mistral|gemini|inference|training|neural|transformer|diffusion|machine.learning|deep.learning|agent|prompt|token|gpu|nvidia|rag|embedding|multimodal|langchain|fine.tun|chatgpt|cursor|copilot|mcp|agentic|generative|reinforcement|computer.vision|launch|release|benchmark|open.source|framework|api|developer|coding|startup)\b/i;

/**
 * Discover trending terms from curated account tweets.
 * Only extracts terms from AI-relevant tweets to avoid picking up
 * unrelated viral topics (sports, politics, K-pop, etc.).
 */
function discoverTrendingTerms(
  tweets: Tweet[],
  existingQueries: string[],
  minAccounts: number = 3
): string[] {
  const existingTerms = extractExistingTerms(existingQueries);

  // Count how many unique accounts mention each term
  const termAccounts = new Map<string, Set<string>>();

  for (const tweet of tweets) {
    const text = tweet.text;
    const handle = tweet.author_handle.toLowerCase();

    // Only extract terms from tweets that have AI context
    if (!AI_CONTEXT_PATTERN.test(text)) continue;

    // Extract capitalized words (likely proper nouns / product names)
    const words = text.match(/\b[A-Z][a-z]{2,}\b/g) || [];
    // Extract ALL-CAPS words (acronyms, product names)
    const acronyms = text.match(/\b[A-Z]{2,6}\b/g) || [];
    // Extract CamelCase terms (product names like "ChatGPT", "DeepSeek")
    const camelCase = text.match(/\b[A-Z][a-z]+[A-Z][a-zA-Z]*\b/g) || [];

    const candidates = [...words, ...acronyms, ...camelCase];

    for (const term of candidates) {
      const lower = term.toLowerCase();
      if (STOP_WORDS.has(lower)) continue;
      if (lower.length < 3) continue;
      if (existingTerms.has(lower)) continue;
      // Skip very common AI words that are already covered
      if (/^(ai|llm|gpt|api|ceo|cto|ml|nlp|gpu|cpu|sdk|ios)$/i.test(term)) continue;

      if (!termAccounts.has(term)) {
        termAccounts.set(term, new Set());
      }
      termAccounts.get(term)!.add(handle);
    }
  }

  // Find terms mentioned by minAccounts or more different accounts
  const trending: { term: string; count: number }[] = [];
  for (const [term, accounts] of termAccounts) {
    if (accounts.size >= minAccounts) {
      trending.push({ term, count: accounts.size });
    }
  }

  // Sort by number of accounts mentioning it, take top 5
  trending.sort((a, b) => b.count - a.count);
  const discovered = trending.slice(0, 5).map((t) => t.term);

  if (discovered.length > 0) {
    console.log(
      `[Twitter] Discovered trending terms: ${discovered.map((t) => `"${t}" (${termAccounts.get(t)!.size} accounts)`).join(", ")}`
    );
  }

  return discovered;
}

export async function fetchTwitterSection(
  queries: string[],
  maxResultsPerQuery: number,
  minViews: number,
  accounts?: string[]
): Promise<Tweet[]> {
  const allTweets = new Map<string, Tweet>();
  const allUsers: XApiUser[] = [];

  // 1. Keyword search
  for (const query of queries) {
    try {
      const { tweets, users } = await searchTweets(query, maxResultsPerQuery);
      allUsers.push(...users);

      for (const apiTweet of tweets) {
        if (!allTweets.has(apiTweet.id)) {
          const tweet = buildTweet(apiTweet, allUsers);
          if (tweet.views >= minViews) {
            allTweets.set(apiTweet.id, tweet);
          }
        }
      }
    } catch (err) {
      console.error(`X API query failed: "${query}"`, err);
    }
  }

  // 2. Account timelines (hybrid approach)
  if (accounts && accounts.length > 0) {
    const startTime = new Date(Date.now() - LOOKBACK_MS).toISOString();
    console.log(`[Twitter] Fetching timelines for ${accounts.length} accounts...`);

    try {
      const resolvedUsers = await resolveUsernames(accounts);
      allUsers.push(...resolvedUsers);
      console.log(`[Twitter] Resolved ${resolvedUsers.length}/${accounts.length} accounts`);

      for (const user of resolvedUsers) {
        try {
          const { tweets, users } = await fetchUserTimeline(user.id, startTime);
          allUsers.push(...users);

          for (const apiTweet of tweets) {
            if (!allTweets.has(apiTweet.id)) {
              const tweet = buildTweet(apiTweet, allUsers);
              if (tweet.views >= minViews) {
                allTweets.set(apiTweet.id, tweet);
              }
            }
          }
        } catch (err) {
          console.error(`[Twitter] Timeline failed for @${user.username}:`, err);
        }
      }
    } catch (err) {
      console.error("[Twitter] Account timeline fetch failed:", err);
    }
  }

  // 3. Trending term discovery — find viral topics from curated accounts
  //    then run follow-up searches to catch more tweets about them
  const timelineTweets = Array.from(allTweets.values());
  if (timelineTweets.length > 0) {
    const trendingTerms = discoverTrendingTerms(timelineTweets, queries);

    for (const term of trendingTerms) {
      try {
        const query = `"${term}" AI OR "${term}" launch OR "${term}" model OR "${term}"`;
        const { tweets, users } = await searchTweets(query, 100);
        allUsers.push(...users);

        let added = 0;
        for (const apiTweet of tweets) {
          if (!allTweets.has(apiTweet.id)) {
            const tweet = buildTweet(apiTweet, allUsers);
            if (tweet.views >= minViews) {
              allTweets.set(apiTweet.id, tweet);
              added++;
            }
          }
        }
        if (added > 0) {
          console.log(`[Twitter] Trending search "${term}": +${added} tweets`);
        }
      } catch (err) {
        console.error(`[Twitter] Trending search failed for "${term}":`, err);
      }
    }
  }

  // Filter freshness
  const cutoff = new Date(Date.now() - LOOKBACK_MS).getTime();
  const fresh = Array.from(allTweets.values()).filter((t) => {
    if (!t.created_at) return true;
    return new Date(t.created_at).getTime() >= cutoff;
  });

  // Sort by engagement, deduplicated
  const sorted = fresh.sort(
    (a, b) => totalEngagement(b) - totalEngagement(a)
  );

  return sorted;
}

