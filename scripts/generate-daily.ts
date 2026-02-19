import { runDailyPipeline } from "../lib/pipeline";

async function main() {
  console.log("[Generate] Starting daily pipeline...");
  const result = await runDailyPipeline();
  console.log("[Generate] Done:", JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error("[Generate] Failed:", err);
  process.exit(1);
});
