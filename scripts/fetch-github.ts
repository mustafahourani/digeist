import { fetchGitHubTrending } from "@/lib/sources/github";
import { readFile, writeFile } from "fs/promises";
import path from "path";
import keywords from "@/config/keywords.json";

async function main() {
  const repos = await fetchGitHubTrending(keywords.github.topics, keywords.github.min_stars);

  // Update today's digest
  const digestPath = path.join(process.cwd(), "data", "digests", "2026-02-17.json");
  const digest = JSON.parse(await readFile(digestPath, "utf-8"));
  digest.sections.github.repos = repos;
  await writeFile(digestPath, JSON.stringify(digest, null, 2));

  console.log("\n=== TOP REPOS (saved to digest) ===");
  repos.forEach((r, i) => {
    console.log(`${i + 1}. ${r.name} (${r.stars.toLocaleString()}★, +${r.stars_delta || 0} today) — ${r.description.slice(0, 120)}`);
  });
}

main().catch(console.error);
