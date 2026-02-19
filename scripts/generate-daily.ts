import { existsSync } from "fs";
import path from "path";
import { runDailyPipeline } from "../lib/pipeline";

function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

async function main() {
  const today = getToday();
  const digestPath = path.join(process.cwd(), "data", "digests", `${today}.json`);

  if (existsSync(digestPath)) {
    console.log(`[Generate] Digest for ${today} already exists, skipping.`);
    return;
  }

  console.log(`[Generate] Starting daily pipeline for ${today}...`);
  const result = await runDailyPipeline();
  console.log("[Generate] Done:", JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error("[Generate] Failed:", err);
  process.exit(1);
});
