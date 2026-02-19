/**
 * Rerun only the Reddit section of today's digest.
 * Usage: npx tsx scripts/rerun-reddit.ts
 */
import "dotenv/config";
import { fetchReddit } from "../lib/sources/reddit";
import { cleanRedditTitles } from "../lib/ai/summarize";
import { getDigest, saveDigest } from "../lib/storage";
import { getToday } from "../lib/utils";

async function main() {
  const date = getToday();
  console.log(`[Reddit Rerun] Fetching Reddit posts for ${date}...`);

  const { hot_posts, rising_posts } = await fetchReddit();
  console.log(`[Reddit Rerun] Got ${hot_posts.length} hot + ${rising_posts.length} rising posts`);

  // Clean up titles with Claude
  const allPosts = [...hot_posts, ...rising_posts];
  const cleaned = await cleanRedditTitles(allPosts);
  const titleMap = new Map(cleaned.map((p) => [p.id, p.title]));

  for (const post of [...hot_posts, ...rising_posts]) {
    post.title = titleMap.get(post.id) || post.title;
  }

  const existing = await getDigest(date);
  if (!existing) {
    console.error(`[Reddit Rerun] No existing digest for ${date}. Run full pipeline first.`);
    process.exit(1);
  }

  existing.sections.reddit = { hot_posts, rising_posts };
  existing.sources_status.reddit = "success";
  existing.generated_at = new Date().toISOString();
  await saveDigest(existing);
  console.log(`[Reddit Rerun] Updated digest for ${date} with new Reddit data`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
