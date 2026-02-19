/**
 * Rerun HN + Reddit sections of today's digest (skips GitHub).
 * Usage: npx tsx scripts/rerun-hn-reddit.ts
 */
import "dotenv/config";
import { fetchHackerNews } from "../lib/sources/hackernews";
import { fetchReddit } from "../lib/sources/reddit";
import { summarizeHNStories, cleanRedditTitles } from "../lib/ai/summarize";
import { getDigest, saveDigest } from "../lib/storage";
import { getToday } from "../lib/utils";

async function main() {
  const date = getToday();
  console.log(`[Rerun] HN + Reddit only for ${date}`);

  const [hnResult, redditResult] = await Promise.all([
    fetchHackerNews(),
    fetchReddit(),
  ]);

  console.log(
    `[Rerun] HN: ${hnResult.hot_stories.length} hot, ${hnResult.rising_stories.length} rising`
  );
  console.log(
    `[Rerun] Reddit: ${redditResult.hot_posts.length} hot, ${redditResult.rising_posts.length} rising`
  );

  // AI processing in parallel
  const allHN = [...hnResult.hot_stories, ...hnResult.rising_stories];
  const allReddit = [...redditResult.hot_posts, ...redditResult.rising_posts];
  const [summarized, cleaned] = await Promise.all([
    summarizeHNStories(allHN),
    cleanRedditTitles(allReddit),
  ]);

  // Apply HN summaries
  const hnMap = new Map(summarized.map((s) => [s.id, s.summary]));
  for (const s of [...hnResult.hot_stories, ...hnResult.rising_stories]) {
    s.summary = hnMap.get(s.id) || s.summary || "";
  }

  // Apply cleaned Reddit titles
  const redditMap = new Map(cleaned.map((p) => [p.id, p.title]));
  for (const p of [...redditResult.hot_posts, ...redditResult.rising_posts]) {
    p.title = redditMap.get(p.id) || p.title;
  }

  const existing = await getDigest(date);
  if (!existing) {
    console.error(`[Rerun] No existing digest for ${date}. Run full pipeline first.`);
    process.exit(1);
  }

  existing.sections.hackernews = hnResult;
  existing.sections.reddit = redditResult;
  existing.sources_status.hackernews = "success";
  existing.sources_status.reddit = "success";
  existing.generated_at = new Date().toISOString();
  await saveDigest(existing);
  console.log(`[Rerun] Updated digest for ${date}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
