import { getDigestsForRange, getWeeklyDigest, saveWeeklyDigest } from "./storage";
import { generateWeeklyRollup } from "./ai/weekly";
import { getISOWeek } from "./utils";
import type { WeeklyDigest } from "./types";


function getWeekDates(weekStr?: string): { start: string; end: string; week: string } {
  const now = new Date();

  if (weekStr) {
    // Parse "2026-W07" format
    const [yearStr, weekNum] = weekStr.replace("W", "").split("-");
    const year = parseInt(yearStr);
    const week = parseInt(weekNum);

    // Calculate the start of the ISO week
    const jan1 = new Date(year, 0, 1);
    const dayOfWeek = jan1.getDay() || 7;
    const startOfWeek1 = new Date(jan1);
    startOfWeek1.setDate(jan1.getDate() + (1 - dayOfWeek));

    const start = new Date(startOfWeek1);
    start.setDate(start.getDate() + (week - 1) * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);

    return {
      start: start.toISOString().split("T")[0],
      end: end.toISOString().split("T")[0],
      week: `${year}-W${String(week).padStart(2, "0")}`,
    };
  }

  // Default: current week ending today (Sunday)
  const end = new Date(now);
  const start = new Date(now);
  start.setDate(end.getDate() - 6);

  return {
    start: start.toISOString().split("T")[0],
    end: end.toISOString().split("T")[0],
    week: getISOWeek(end.toISOString().split("T")[0]),
  };
}

export async function runWeeklyPipeline(weekStr?: string): Promise<WeeklyDigest> {
  const { start, end, week } = getWeekDates(weekStr);
  console.log(`[Weekly Pipeline] Generating rollup for ${week} (${start} to ${end})`);

  // Get all daily digests for this week
  const digests = await getDigestsForRange(start, end);
  console.log(`[Weekly Pipeline] Found ${digests.length} daily digests`);

  if (digests.length === 0) {
    throw new Error(`No daily digests found for week ${week}`);
  }

  // Get previous week's summary for comparison
  const prevWeekParts = week.split("-W");
  const prevWeekNum = parseInt(prevWeekParts[1]) - 1;
  const prevWeek =
    prevWeekNum > 0
      ? `${prevWeekParts[0]}-W${String(prevWeekNum).padStart(2, "0")}`
      : null;

  let previousWeekSummary: string | null = null;
  if (prevWeek) {
    const prevDigest = await getWeeklyDigest(prevWeek);
    if (prevDigest) {
      previousWeekSummary = prevDigest.week_over_week;
    }
  }

  // Generate the rollup via AI
  console.log("[Weekly Pipeline] Generating AI rollup...");
  const result = await generateWeeklyRollup(digests, previousWeekSummary);

  const weeklyDigest: WeeklyDigest = {
    week,
    start_date: start,
    end_date: end,
    generated_at: new Date().toISOString(),
    top_themes: result.top_themes,
    source_highlights: result.source_highlights,
    week_over_week: result.week_over_week,
  };

  await saveWeeklyDigest(weeklyDigest);
  console.log(`[Weekly Pipeline] Done! Weekly digest saved for ${week}`);

  return weeklyDigest;
}
