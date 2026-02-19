import { fetchGitHubTrending } from "./sources/github";
import { fetchHackerNews } from "./sources/hackernews";
import { fetchReddit } from "./sources/reddit";
import { summarizeHNStories, cleanRedditTitles } from "./ai/summarize";
import { saveDigest } from "./storage";
import { getToday } from "./utils";
import type {
  Digest,
  SourceName,
  SourceStatus,
  GitHubSection,
  HNSection,
  RedditSection,
  GitHubRepo,
  HNStory,
  RedditPost,
} from "./types";
import keywords from "@/config/keywords.json";

// ─── Cross-Source Amplification ─────────────────────────────────────
// Detect overlaps between GitHub, HN, and Reddit and boost items that appear in both.

function crossSourceAmplify(
  githubRepos: GitHubRepo[],
  hnStories: HNStory[],
  redditPosts: RedditPost[]
): void {
  let hnBoostCount = 0;
  let redditGhBoost = 0;

  const repoUrls = new Set(githubRepos.map((r) => r.url.toLowerCase()));
  const repoNames = new Set(githubRepos.map((r) => r.name.toLowerCase()));

  // HN stories linking to tracked GitHub repos → boost the story
  for (const story of hnStories) {
    const storyUrl = story.url.toLowerCase();
    if (repoUrls.has(storyUrl) || repoNames.has(extractGitHubRepo(storyUrl))) {
      story.velocity_score = Math.round((story.velocity_score || story.score) * 1.5);
      hnBoostCount++;
    }
  }

  // Reddit posts linking to tracked GitHub repos → boost the post
  for (const post of redditPosts) {
    const postUrl = post.url.toLowerCase();
    if (repoUrls.has(postUrl) || repoNames.has(extractGitHubRepo(postUrl))) {
      post.velocity_score = Math.round((post.velocity_score || post.score) * 1.5);
      redditGhBoost++;
    }
  }

  // Re-sort after boosting
  hnStories.sort((a, b) => (b.velocity_score || b.score) - (a.velocity_score || a.score));
  redditPosts.sort((a, b) => (b.velocity_score || b.score) - (a.velocity_score || a.score));

  if (hnBoostCount > 0 || redditGhBoost > 0) {
    console.log(`[Pipeline] Cross-source: ${hnBoostCount} HN stories + ${redditGhBoost} Reddit posts boosted (linked to GitHub repos)`);
  }
}

function extractGitHubRepo(url: string): string {
  const match = url.match(/github\.com\/([^/]+\/[^/]+)/);
  return match ? match[1].toLowerCase() : "";
}

interface FetchResults {
  githubRepos: GitHubRepo[];
  githubSplit: { new_repos: GitHubRepo[]; trending_repos: GitHubRepo[] };
  hnStories: HNStory[];
  hnSplit: { hot_stories: HNStory[]; rising_stories: HNStory[] };
  redditPosts: RedditPost[];
  redditSplit: { hot_posts: RedditPost[]; rising_posts: RedditPost[] };
  statuses: Record<SourceName, SourceStatus>;
}

async function fetchAllSources(): Promise<FetchResults> {
  const statuses: Record<SourceName, SourceStatus> = {
    github: "success",
    hackernews: "success",
    reddit: "success",
  };

  const [githubResult, hnResult, redditResult] = await Promise.allSettled([
    fetchGitHubTrending(keywords.github.topics, keywords.github.min_stars),
    fetchHackerNews(),
    fetchReddit(),
  ]);

  const githubData =
    githubResult.status === "fulfilled" ? githubResult.value : { new_repos: [], trending_repos: [] };
  const githubRepos = [...githubData.new_repos, ...githubData.trending_repos];
  if (githubResult.status === "rejected") {
    console.error("GitHub fetch failed:", githubResult.reason);
    statuses.github = "error";
  }

  const hnData =
    hnResult.status === "fulfilled" ? hnResult.value : { hot_stories: [], rising_stories: [] };
  const hnStories = [...hnData.hot_stories, ...hnData.rising_stories];
  if (hnResult.status === "rejected") {
    console.error("HN fetch failed:", hnResult.reason);
    statuses.hackernews = "error";
  }

  const redditData =
    redditResult.status === "fulfilled" ? redditResult.value : { hot_posts: [], rising_posts: [] };
  const redditPosts = [...redditData.hot_posts, ...redditData.rising_posts];
  if (redditResult.status === "rejected") {
    console.error("Reddit fetch failed:", redditResult.reason);
    statuses.reddit = "error";
  }

  return {
    githubRepos,
    githubSplit: githubData,
    hnStories,
    hnSplit: hnData,
    redditPosts,
    redditSplit: redditData,
    statuses,
  };
}

export async function runDailyPipeline(): Promise<Digest> {
  const date = getToday();
  console.log(`[Pipeline] Starting daily digest for ${date}`);

  // Step 1: Fetch all sources
  console.log("[Pipeline] Fetching sources...");
  const { githubRepos, githubSplit, hnStories, hnSplit, redditPosts, redditSplit, statuses } =
    await fetchAllSources();

  console.log(
    `[Pipeline] Fetched: ${githubRepos.length} repos, ${hnStories.length} HN stories, ${redditPosts.length} Reddit posts`
  );

  // Step 1.5: Cross-source amplification (GitHub ↔ HN ↔ Reddit)
  crossSourceAmplify(githubRepos, hnStories, redditPosts);

  // Step 2: AI Processing — summarize HN stories + clean Reddit titles in parallel
  console.log("[Pipeline] AI processing...");
  const [summarizedHN, cleanedReddit] = await Promise.all([
    statuses.hackernews === "success" ? summarizeHNStories(hnStories) : Promise.resolve([]),
    statuses.reddit === "success" ? cleanRedditTitles(redditPosts) : Promise.resolve([]),
  ]);

  // Apply HN summaries
  const hnSummaryMap = new Map(summarizedHN.map((s) => [s.id, s.summary]));
  for (const story of [...hnSplit.hot_stories, ...hnSplit.rising_stories]) {
    story.summary = hnSummaryMap.get(story.id) || story.summary || "";
  }

  // Apply cleaned Reddit titles
  const redditTitleMap = new Map(cleanedReddit.map((p) => [p.id, p.title]));
  for (const post of [...redditSplit.hot_posts, ...redditSplit.rising_posts]) {
    post.title = redditTitleMap.get(post.id) || post.title;
  }

  // Step 3: Assemble and save digest
  const githubSection: GitHubSection = { new_repos: githubSplit.new_repos, trending_repos: githubSplit.trending_repos };
  const hnSection: HNSection = { hot_stories: hnSplit.hot_stories, rising_stories: hnSplit.rising_stories };
  const redditSection: RedditSection = { hot_posts: redditSplit.hot_posts, rising_posts: redditSplit.rising_posts };

  const digest: Digest = {
    date,
    generated_at: new Date().toISOString(),
    sources_status: statuses,
    sections: {
      github: githubSection,
      hackernews: hnSection,
      reddit: redditSection,
    },
  };

  console.log("[Pipeline] Saving digest...");
  await saveDigest(digest);
  console.log(`[Pipeline] Done! Digest saved for ${date}`);

  return digest;
}
