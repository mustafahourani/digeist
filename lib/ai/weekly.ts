import Anthropic from "@anthropic-ai/sdk";
import type { Digest, WeeklyDigest, WeeklyTheme } from "@/lib/types";
import { SYSTEM_PROMPT } from "./prompts";

const MODEL = "claude-sonnet-4-5-20250929";

function getClient(): Anthropic {
  return new Anthropic();
}

function parseJSON<T>(text: string): T {
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = jsonMatch ? jsonMatch[1].trim() : text.trim();
  return JSON.parse(raw);
}

interface WeeklyAIResult {
  top_themes: {
    name: string;
    summary: string;
    sentiment_avg: number;
    days_appeared: number;
    total_engagement: number;
  }[];
  source_highlights: {
    ai_twitter: string[];
    crypto_ai_twitter: string[];
    github: string[];
    hackernews: string[];
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
    ai_clusters: d.sections.ai_twitter.clusters.map((c) => ({
      name: c.name,
      sentiment_pct: c.sentiment_pct,
      total_engagement: c.total_engagement,
    })),
    crypto_clusters: d.sections.crypto_ai_twitter.clusters.map((c) => ({
      name: c.name,
      sentiment_pct: c.sentiment_pct,
      total_engagement: c.total_engagement,
    })),
    top_github: d.sections.github.repos.slice(0, 5).map((r) => r.name),
    top_hn: d.sections.hackernews.stories.slice(0, 5).map((s) => s.title),
  }));

  const prompt = `You are generating a weekly rollup from ${digests.length} daily AI industry digests.

Here are the daily digest summaries:
${JSON.stringify(dailySummaries, null, 2)}

${previousWeekSummary ? `Last week's summary for comparison: "${previousWeekSummary}"` : "This is the first weekly rollup, so no previous week comparison is available."}

Generate:
1. **Top 10 themes of the week**: The most significant clusters/topics across all daily digests, ranked by cumulative engagement. For each, note how many days it appeared.
2. **Source highlights**: Top 5 items per source for the week (cluster names for Twitter, repo names for GitHub, story titles for HN).
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
    "ai_twitter": ["top 5 cluster names"],
    "crypto_ai_twitter": ["top 5 cluster names"],
    "github": ["top 5 repo names"],
    "hackernews": ["top 5 story titles"]
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
