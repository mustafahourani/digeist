#!/usr/bin/env npx tsx

import "dotenv/config";
import { runAgent } from "./agent";
import { buildDailyBriefingPrompt } from "./prompts/daily-briefing";
import { buildArticlePrompt } from "./prompts/article";
import { buildFeedbackPrompt } from "./prompts/feedback";
import { buildWeeklyPrompt } from "./prompts/weekly";

function getToday(): string {
  return new Date().toISOString().split("T")[0];
}

function getWeekLabel(date: Date): string {
  // ISO week number
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum = Math.round(
    ((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7
  ) + 1;
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

function getWeekRange(date: Date): { start: string; end: string } {
  const d = new Date(date);
  const day = d.getDay();
  // Monday start
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((day + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: monday.toISOString().split("T")[0],
    end: sunday.toISOString().split("T")[0],
  };
}

function parseArgs(): {
  mode: "daily" | "weekly" | "article" | "feedback";
  date: string;
  articleTopic?: string;
} {
  const args = process.argv.slice(2);
  let mode: "daily" | "weekly" | "article" | "feedback" = "daily";
  let date = getToday();
  let articleTopic: string | undefined;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--date":
        date = args[++i];
        break;
      case "--weekly":
        mode = "weekly";
        break;
      case "--article":
        mode = "article";
        articleTopic = args[++i];
        break;
      case "--feedback":
        mode = "feedback";
        break;
      case "--help":
        console.log(`
digeist-agent — Proactive Content Strategist

Usage:
  npx tsx agent/run.ts                     Run today's daily briefing
  npx tsx agent/run.ts --date 2026-02-19   Run briefing for a specific date
  npx tsx agent/run.ts --weekly            Run weekly strategy memo
  npx tsx agent/run.ts --article "MCP"     Write article on a chosen topic
  npx tsx agent/run.ts --feedback          Process feedback for today

Options:
  --date <YYYY-MM-DD>   Target date (defaults to today)
  --weekly              Generate weekly strategy memo
  --article <topic>     Generate article on the given topic
  --feedback            Process feedback for the target date
  --help                Show this help message
`);
        process.exit(0);
    }
  }

  return { mode, date, articleTopic };
}

async function main() {
  const { mode, date, articleTopic } = parseArgs();

  console.log(`\n╔══════════════════════════════════════╗`);
  console.log(`║   digeist-agent                      ║`);
  console.log(`╚══════════════════════════════════════╝\n`);
  console.log(`Mode: ${mode}`);
  console.log(`Date: ${date}`);
  if (articleTopic) console.log(`Topic: ${articleTopic}`);
  console.log("");

  const startTime = Date.now();

  let prompt: string;

  switch (mode) {
    case "daily":
      prompt = buildDailyBriefingPrompt(date);
      break;

    case "weekly": {
      const targetDate = new Date(date);
      const weekLabel = getWeekLabel(targetDate);
      const { start, end } = getWeekRange(targetDate);
      console.log(`Week: ${weekLabel} (${start} to ${end})`);
      prompt = buildWeeklyPrompt(weekLabel, start, end);
      break;
    }

    case "article":
      if (!articleTopic) {
        console.error("Error: --article requires a topic. Example: --article \"MCP protocol\"");
        process.exit(1);
      }
      prompt = buildArticlePrompt(articleTopic, date);
      break;

    case "feedback":
      prompt = buildFeedbackPrompt(date);
      break;
  }

  try {
    const result = await runAgent(prompt);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`\n${"─".repeat(50)}`);
    console.log(`Status: ${result.success ? "✓ Complete" : "✗ Failed"}`);
    console.log(`Turns: ${result.turns}`);
    console.log(`Tokens: ${result.inputTokens.toLocaleString()} in / ${result.outputTokens.toLocaleString()} out`);

    // Estimate cost (Opus pricing: $15/MTok input, $75/MTok output)
    const inputCost = (result.inputTokens / 1_000_000) * 15;
    const outputCost = (result.outputTokens / 1_000_000) * 75;
    console.log(`Est. cost: $${(inputCost + outputCost).toFixed(2)}`);
    console.log(`Time: ${elapsed}s`);

    if (result.success) {
      switch (mode) {
        case "daily":
          console.log(`\nBriefing written to: data/agent/briefings/${date}.md`);
          break;
        case "weekly": {
          const weekLabel = getWeekLabel(new Date(date));
          console.log(`\nWeekly memo written to: data/agent/weekly/${weekLabel}.md`);
          break;
        }
        case "article":
          console.log(`\nArticle written to: data/agent/articles/${date}-*.md`);
          break;
        case "feedback":
          console.log(`\nFeedback processed and preferences updated.`);
          break;
      }
    } else {
      console.error(`\nAgent failed: ${result.finalText}`);
      process.exit(1);
    }
  } catch (err) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`\nFatal error after ${elapsed}s:`);
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
