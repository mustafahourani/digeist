import type { Digest } from "@/lib/types";
import { SYSTEM_PROMPT } from "./prompts";
import { getClient, MODEL, parseJSON } from "./client";

interface WeeklyAIResult {
  top_themes: {
    name: string;
    summary: string;
    sentiment_avg: number;
    days_appeared: number;
    total_engagement: number;
  }[];
  source_highlights: {
    github: string[];
    hackernews: string[];
    reddit: string[];
  };
  week_over_week: string;
}

export async function generateWeeklyRollup(
  digests: Digest[],
  previousWeekSummary: string | null
): Promise<WeeklyAIResult> {
  const client = getClient();

  // Build a summary of each day's digest for the AI
  const dailySummaries = digests.map((d) => ({
    date: d.date,
    top_github: [...d.sections.github.new_repos, ...d.sections.github.trending_repos].slice(0, 5).map((r) => r.name),
    top_hn: [...d.sections.hackernews.hot_stories, ...d.sections.hackernews.rising_stories].slice(0, 5).map((s) => s.title),
    top_reddit: [
      ...(d.sections.reddit?.hot_posts || []),
      ...(d.sections.reddit?.rising_posts || []),
    ].slice(0, 5).map((p) => `[r/${p.subreddit}] ${p.title}`),
  }));

  const prompt = `You are generating a weekly rollup from ${digests.length} daily AI industry digests.

Here are the daily digest summaries:
${JSON.stringify(dailySummaries, null, 2)}

${previousWeekSummary ? `Last week's summary for comparison: "${previousWeekSummary}"` : "This is the first weekly rollup, so no previous week comparison is available."}

Generate:
1. **Top 10 themes of the week**: The most significant topics across all daily digests, ranked by importance. For each, note how many days it appeared.
2. **Source highlights**: Top 5 items per source for the week (repo names for GitHub, story titles for HN, post titles for Reddit).
3. **Week-over-week comparison**: ${previousWeekSummary ? "A brief 2-3 sentence comparison noting what's new this week vs last week." : "A brief 2-3 sentence summary of this week's overall themes."}

Respond with this exact JSON structure:
{
  "top_themes": [
    {
      "name": "Theme name",
      "summary": "2-3 sentence neutral summary",
      "sentiment_avg": 75,
      "days_appeared": 4,
      "total_engagement": 234000
    }
  ],
  "source_highlights": {
    "github": ["top 5 repo names"],
    "hackernews": ["top 5 story titles"],
    "reddit": ["top 5 post titles"]
  },
  "week_over_week": "Comparison or summary string"
}`;

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude");
  }

  return parseJSON<WeeklyAIResult>(textBlock.text);
}
