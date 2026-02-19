/**
 * Rerun only the GitHub section of today's digest.
 * Usage: npx tsx scripts/rerun-github.ts
 */
import "dotenv/config";
import { fetchGitHubTrending } from "../lib/sources/github";
import { getDigest, saveDigest } from "../lib/storage";
import { getToday } from "../lib/utils";
import keywords from "../config/keywords.json";

async function main() {
  const date = getToday();
  console.log(`[GitHub Rerun] Fetching GitHub repos for ${date}...`);

  const { new_repos, trending_repos } = await fetchGitHubTrending(keywords.github.topics, keywords.github.min_stars);
  console.log(`[GitHub Rerun] Got ${new_repos.length} new + ${trending_repos.length} trending repos`);

  const existing = await getDigest(date);
  if (!existing) {
    console.error(`[GitHub Rerun] No existing digest for ${date}. Run full pipeline first.`);
    process.exit(1);
  }

  existing.sections.github = { new_repos, trending_repos };
  existing.generated_at = new Date().toISOString();
  await saveDigest(existing);
  console.log(`[GitHub Rerun] Updated digest for ${date} with new GitHub data`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
