import { fetchTwitterSection } from "./sources/twitter";
import { fetchGitHubTrending } from "./sources/github";
import { fetchHackerNews } from "./sources/hackernews";
import {
  clusterTweets,
  summarizeHNStories,
} from "./ai/summarize";
import { runDiscovery } from "./discovery";
import { saveDigest } from "./storage";
import { getToday, NON_LATIN_RE } from "./utils";
import type {
  Digest,
  SourceName,
  SourceStatus,
  TwitterSection,
  GitHubSection,
  HNSection,
  Tweet,
  GitHubRepo,
  HNStory,
  Cluster,
} from "./types";
import keywords from "@/config/keywords.json";

// ─── English Language Filter ────────────────────────────────────────
// Search API uses lang:en, but curated account timelines return all languages.
// Use a lightweight heuristic: if the tweet has very few common English words,
// it's likely non-English.

const ENGLISH_COMMON = new Set([
  "the", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would",
  "could", "should", "may", "might", "can", "shall",
  "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "as", "into", "about", "than",
  "this", "that", "these", "those", "it", "its", "not", "no",
  "we", "you", "they", "he", "she", "i", "my", "your", "our",
  "what", "which", "who", "how", "when", "where", "why",
  "new", "just", "like", "more", "so", "if", "all", "also",
]);

function isLikelyEnglish(text: string): boolean {
  const cleaned = text
    .replace(/https?:\/\/\S+/g, "")
    .replace(/@\w+/g, "")
    .replace(/#\w+/g, "")
    .trim();

  // Reject if any CJK, Arabic, Cyrillic, or Thai characters
  if (NON_LATIN_RE.test(cleaned)) return false;

  // Check ratio of common English words — 15% threshold
  const words = cleaned.toLowerCase().split(/\s+/).filter((w) => w.length > 1);
  if (words.length < 3) return true;

  const ratio = words.filter((w) => ENGLISH_COMMON.has(w)).length / words.length;
  return ratio >= 0.15;
}

function filterNonEnglish(tweets: Tweet[]): Tweet[] {
  const filtered = tweets.filter((t) => isLikelyEnglish(t.text));
  const removed = tweets.length - filtered.length;
  if (removed > 0) {
    console.log(`[Pipeline] Language filter: removed ${removed}/${tweets.length} non-English tweets`);
  }
  return filtered;
}

// ─── Crypto Relevance Filter ────────────────────────────────────────
// Tweets from search queries can be general AI without any crypto angle.
// Keep tweets from curated accounts (inherently crypto-AI perspective)
// and tweets with crypto/web3 signal in the text.

const CRYPTO_SIGNAL = /\b(crypto|web3|blockchain|on.?chain|depin|decentrali[sz]ed|token|tokeniz|nft|dao|defi|defai|subnet|bittensor|tao|solana|ethereum|eth\b|sol\b|bitcoin|btc\b|wallet|smart.contract|consensus|validator|staking|airdrop|mint|l1\b|l2\b|layer.?[12]|zk\b|rollup|dex|amm|liquidity|yield|vault|cosmos|polkadot|arbitrum|optimism|avalanche|polygon|sei\b|sui\b|aptos|monad|berachain|eigenlayer|restaking|fetch\.ai|singularitynet|ocean.protocol|render.network|rendernetwork|akash|io\.net|ritualnet|ritual.net|gensyn|allora|withvana|sentient.agi|nillion|morpheus.ai|virtuals|eliza.?os|ai16z|aixbt|truth.terminal|nous.research|pondgnn|pond.gnn|getgrass|grass.io|opentensor)\b/i;

function filterCryptoRelevance(tweets: Tweet[]): Tweet[] {
  const curatedAccounts = new Set(
    (keywords.crypto_ai_twitter.accounts as string[]).map((a) => a.toLowerCase())
  );

  const filtered = tweets.filter((t) => {
    const handle = t.author_handle.replace("@", "").toLowerCase();
    if (curatedAccounts.has(handle)) return true;
    return CRYPTO_SIGNAL.test(t.text);
  });

  const removed = tweets.length - filtered.length;
  if (removed > 0) {
    console.log(`[Pipeline] Crypto filter: removed ${removed}/${tweets.length} non-crypto tweets`);
  }
  return filtered;
}

// ─── Cross-Source Amplification ─────────────────────────────────────
// Detect overlaps between sources and boost items that appear across multiple.

function crossSourceAmplify(
  aiTweets: Tweet[],
  cryptoTweets: Tweet[],
  githubRepos: GitHubRepo[],
  hnStories: HNStory[]
): void {
  let boostCount = 0;

  // Build lookup sets
  const repoUrls = new Set(githubRepos.map((r) => r.url.toLowerCase()));
  const repoNames = new Set(githubRepos.map((r) => r.name.toLowerCase()));

  // 1. Tweets mentioning GitHub repos → boost sort order (not actual values)
  const allTweets = [...aiTweets, ...cryptoTweets];
  const boostedTweetIds = new Set<string>();

  for (const tweet of allTweets) {
    const text = tweet.text.toLowerCase();

    for (const repoName of repoNames) {
      // Check if tweet text contains repo name (e.g., "langchain-ai/langchain")
      // or the short name (e.g., "langchain")
      const shortName = repoName.split("/")[1] || repoName;
      if (
        text.includes(repoName) ||
        (shortName.length > 3 && text.includes(shortName))
      ) {
        boostedTweetIds.add(tweet.id);
        boostCount++;
        break;
      }
    }
  }

  // Re-sort tweets: boosted tweets get 1.5x weight for sorting only
  if (boostedTweetIds.size > 0) {
    const engagementWithBoost = (t: Tweet) => {
      const base = t.likes + t.retweets + t.quotes;
      return boostedTweetIds.has(t.id) ? base * 1.5 : base;
    };
    aiTweets.sort((a, b) => engagementWithBoost(b) - engagementWithBoost(a));
    cryptoTweets.sort((a, b) => engagementWithBoost(b) - engagementWithBoost(a));
  }

  // 2. HN stories linking to tracked GitHub repos → boost the story
  for (const story of hnStories) {
    const storyUrl = story.url.toLowerCase();
    if (repoUrls.has(storyUrl) || repoNames.has(extractGitHubRepo(storyUrl))) {
      story.velocity_score = Math.round((story.velocity_score || story.score) * 1.5);
      boostCount++;
    }
  }

  // 3. HN stories whose titles match high-engagement tweet topics
  // Extract key terms from top tweets (>1000 engagement)
  const tweetTerms = new Set<string>();
  for (const tweet of allTweets) {
    const engagement = tweet.likes + tweet.retweets + tweet.quotes;
    if (engagement < 1000) continue;

    // Extract capitalized terms and known product names
    const words = tweet.text.match(/\b[A-Z][a-z]{3,}\b/g) || [];
    const acronyms = tweet.text.match(/\b[A-Z]{2,6}\b/g) || [];
    for (const w of [...words, ...acronyms]) {
      if (w.length >= 4) tweetTerms.add(w.toLowerCase());
    }
  }

  // Boost HN stories matching tweet trending terms
  for (const story of hnStories) {
    const titleLower = story.title.toLowerCase();
    let matches = 0;
    for (const term of tweetTerms) {
      if (titleLower.includes(term)) matches++;
    }
    if (matches >= 2) {
      story.velocity_score = Math.round((story.velocity_score || story.score) * 1.2);
      boostCount++;
    }
  }

  // Re-sort HN stories by velocity_score after boosting
  hnStories.sort((a, b) => (b.velocity_score || b.score) - (a.velocity_score || a.score));

  if (boostCount > 0) {
    console.log(
      `[Pipeline] Cross-source: ${boostCount} items boosted (${boostedTweetIds.size} tweets, ${boostCount - boostedTweetIds.size} HN stories)`
    );
  }
}

function extractGitHubRepo(url: string): string {
  const match = url.match(/github\.com\/([^/]+\/[^/]+)/);
  return match ? match[1].toLowerCase() : "";
}

// ─── Cross-Source Tagging ───────────────────────────────────────────
// After AI processing, tag clusters with indicators showing which other
// sources covered the same topic.

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "from", "that", "this", "will", "have",
  "been", "about", "into", "over", "your", "what", "more", "just",
  "than", "them", "their", "some", "could", "would", "should", "being",
  "after", "before", "also", "between", "while", "open", "source", "new",
  "first", "launch", "update", "release", "model", "data", "tool",
]);

function extractClusterTerms(cluster: Cluster): string[] {
  const text = cluster.name.toLowerCase();
  return text
    .split(/[\s/\-–—,.:;!?()]+/)
    .filter((w) => w.length > 3 && !STOP_WORDS.has(w));
}

function tagCrossSources(
  aiClusters: Cluster[],
  cryptoClusters: Cluster[],
  githubRepos: GitHubRepo[],
  hnStories: HNStory[]
): void {
  let tagCount = 0;

  // Build lookup text for GitHub repos
  const ghTexts = githubRepos.map((r) => {
    const short = (r.name.split("/")[1] || r.name).toLowerCase();
    return `${short} ${r.description?.toLowerCase() || ""}`;
  });

  // Build lookup text for HN stories
  const hnTexts = hnStories.map((s) => s.title.toLowerCase());

  const tagCluster = (cluster: Cluster, isAI: boolean) => {
    const sources: string[] = [];
    const terms = extractClusterTerms(cluster);
    if (terms.length === 0) return;

    // Check GitHub: at least 1 term matches a repo name/description
    for (const ghText of ghTexts) {
      const hits = terms.filter((t) => ghText.includes(t));
      if (hits.length >= 1 && hits.some((h) => h.length > 4)) {
        sources.push("GitHub");
        break;
      }
    }

    // Check HN: at least 1 meaningful term matches a story title
    for (const hnText of hnTexts) {
      const hits = terms.filter((t) => hnText.includes(t));
      if (hits.length >= 1 && hits.some((h) => h.length > 4)) {
        sources.push("Hacker News");
        break;
      }
    }

    // Check the OTHER twitter section
    const otherClusters = isAI ? cryptoClusters : aiClusters;
    for (const other of otherClusters) {
      const otherTerms = extractClusterTerms(other);
      const overlap = terms.filter((t) => otherTerms.includes(t));
      if (overlap.length >= 1 && overlap.some((o) => o.length > 4)) {
        sources.push(isAI ? "Crypto/AI" : "AI");
        break;
      }
    }

    if (sources.length > 0) {
      cluster.cross_sources = sources;
      tagCount++;
    }
  };

  for (const cluster of aiClusters) tagCluster(cluster, true);
  for (const cluster of cryptoClusters) tagCluster(cluster, false);

  if (tagCount > 0) {
    console.log(`[Pipeline] Cross-source tags: ${tagCount} clusters tagged`);
  }
}

interface FetchResults {
  aiTweets: Tweet[];
  cryptoTweets: Tweet[];
  githubRepos: GitHubRepo[];
  hnStories: HNStory[];
  statuses: Record<SourceName, SourceStatus>;
}

async function fetchAllSources(): Promise<FetchResults> {
  const statuses: Record<SourceName, SourceStatus> = {
    ai_twitter: "success",
    crypto_ai_twitter: "success",
    github: "success",
    hackernews: "success",
  };

  // Fetch all 4 sources in parallel
  const [aiResult, cryptoResult, githubResult, hnResult] = await Promise.allSettled([
    fetchTwitterSection(
      keywords.ai_twitter.search_queries,
      keywords.ai_twitter.max_results_per_query,
      keywords.ai_twitter.min_likes,
      keywords.ai_twitter.accounts
    ),
    fetchTwitterSection(
      keywords.crypto_ai_twitter.search_queries,
      keywords.crypto_ai_twitter.max_results_per_query,
      keywords.crypto_ai_twitter.min_likes,
      keywords.crypto_ai_twitter.accounts
    ),
    fetchGitHubTrending(keywords.github.topics, keywords.github.min_stars),
    fetchHackerNews(),
  ]);

  const aiTweets =
    aiResult.status === "fulfilled" ? aiResult.value : [];
  if (aiResult.status === "rejected") {
    console.error("AI Twitter fetch failed:", aiResult.reason);
    statuses.ai_twitter = "error";
  }

  const cryptoTweets =
    cryptoResult.status === "fulfilled" ? cryptoResult.value : [];
  if (cryptoResult.status === "rejected") {
    console.error("Crypto/AI Twitter fetch failed:", cryptoResult.reason);
    statuses.crypto_ai_twitter = "error";
  }

  const githubRepos =
    githubResult.status === "fulfilled" ? githubResult.value : [];
  if (githubResult.status === "rejected") {
    console.error("GitHub fetch failed:", githubResult.reason);
    statuses.github = "error";
  }

  const hnStories =
    hnResult.status === "fulfilled" ? hnResult.value : [];
  if (hnResult.status === "rejected") {
    console.error("HN fetch failed:", hnResult.reason);
    statuses.hackernews = "error";
  }

  return { aiTweets, cryptoTweets, githubRepos, hnStories, statuses };
}

export async function runDailyPipeline(): Promise<Digest> {
  const date = getToday();
  console.log(`[Pipeline] Starting daily digest for ${date}`);

  // Step 1: Fetch all sources
  console.log("[Pipeline] Fetching sources...");
  const { aiTweets: fetchedAiTweets, cryptoTweets: fetchedCryptoTweets, githubRepos, hnStories, statuses } =
    await fetchAllSources();

  // Step 1.1: Filter non-English tweets (curated account timelines don't use lang:en)
  const aiTweets = filterNonEnglish(fetchedAiTweets);
  const cryptoTweets = filterNonEnglish(fetchedCryptoTweets);

  console.log(
    `[Pipeline] Fetched: ${aiTweets.length} AI tweets, ${cryptoTweets.length} crypto tweets, ${githubRepos.length} repos, ${hnStories.length} HN stories`
  );

  // Step 1.5a: Cross-source amplification
  crossSourceAmplify(aiTweets, cryptoTweets, githubRepos, hnStories);

  // Step 1.5b: Discovery — track new authors, auto-promote frequent ones
  console.log("[Pipeline] Running author discovery...");
  const [aiPromoted, cryptoPromoted] = await Promise.all([
    runDiscovery(aiTweets, "ai_twitter").catch((err) => {
      console.error("[Pipeline] AI discovery failed:", err);
      return [] as string[];
    }),
    runDiscovery(cryptoTweets, "crypto_ai_twitter").catch((err) => {
      console.error("[Pipeline] Crypto discovery failed:", err);
      return [] as string[];
    }),
  ]);
  if (aiPromoted.length || cryptoPromoted.length) {
    console.log(
      `[Pipeline] Promoted ${aiPromoted.length} AI + ${cryptoPromoted.length} crypto accounts`
    );
  }

  // Step 1.5c: Filter crypto tweets for crypto relevance before clustering
  const relevantCryptoTweets = filterCryptoRelevance(cryptoTweets);

  // Step 2: AI Processing - cluster tweets and summarize HN (in parallel)
  console.log("[Pipeline] AI processing...");
  const [aiSection, cryptoSection, summarizedStories] = await Promise.all([
    statuses.ai_twitter === "success"
      ? clusterTweets(aiTweets, "AI")
      : Promise.resolve<TwitterSection>({ clusters: [], unclustered: [] }),
    statuses.crypto_ai_twitter === "success"
      ? clusterTweets(relevantCryptoTweets, "AI x Crypto")
      : Promise.resolve<TwitterSection>({ clusters: [], unclustered: [] }),
    statuses.hackernews === "success"
      ? summarizeHNStories(hnStories)
      : Promise.resolve<HNStory[]>([]),
  ]);

  // Step 2.5: Tag clusters with cross-source indicators
  tagCrossSources(aiSection.clusters, cryptoSection.clusters, githubRepos, summarizedStories);

  // Step 3: Assemble and save digest
  const githubSection: GitHubSection = { repos: githubRepos };
  const hnSection: HNSection = { stories: summarizedStories };

  const digest: Digest = {
    date,
    generated_at: new Date().toISOString(),
    sources_status: statuses,
    sections: {
      ai_twitter: aiSection,
      crypto_ai_twitter: cryptoSection,
      github: githubSection,
      hackernews: hnSection,
    },
  };

  console.log("[Pipeline] Saving digest...");
  await saveDigest(digest);
  console.log(`[Pipeline] Done! Digest saved for ${date}`);

  return digest;
}
