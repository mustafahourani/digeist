/**
 * Rerun only the Hacker News section of today's digest.
 * Usage: npx tsx scripts/rerun-hackernews.ts
 */
import "dotenv/config";
import { fetchHackerNews } from "../lib/sources/hackernews";
import { summarizeHNStories } from "../lib/ai/summarize";
import { getDigest, saveDigest } from "../lib/storage";
import { getToday } from "../lib/utils";

async function main() {
  const date = getToday();
  console.log(`[HN Rerun] Fetching Hacker News stories for ${date}...`);

  const { hot_stories, rising_stories } = await fetchHackerNews();
  console.log(`[HN Rerun] Got ${hot_stories.length} hot + ${rising_stories.length} rising stories`);

  // Summarize all stories with Claude
  const allStories = [...hot_stories, ...rising_stories];
  const summarized = await summarizeHNStories(allStories);
  const summaryMap = new Map(summarized.map((s) => [s.id, s.summary]));

  for (const story of [...hot_stories, ...rising_stories]) {
    story.summary = summaryMap.get(story.id) || story.summary || "";
  }

  const existing = await getDigest(date);
  if (!existing) {
    console.error(`[HN Rerun] No existing digest for ${date}. Run full pipeline first.`);
    process.exit(1);
  }

  existing.sections.hackernews = { hot_stories, rising_stories };
  existing.generated_at = new Date().toISOString();
  await saveDigest(existing);
  console.log(`[HN Rerun] Updated digest for ${date} with new HN data`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
