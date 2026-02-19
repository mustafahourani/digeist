import Anthropic from "@anthropic-ai/sdk";
import type { HNStory, RedditPost } from "@/lib/types";
import { SYSTEM_PROMPT, hnSummaryPrompt, redditTitleCleanupPrompt } from "./prompts";

const MODEL = "claude-sonnet-4-5-20250929";

function getClient(): Anthropic {
  return new Anthropic();
}

async function callClaude(prompt: string): Promise<string> {
  const client = getClient();
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude");
  }
  return textBlock.text;
}

function parseJSON<T>(text: string): T {
  // 1. Try markdown code block (with closing fence)
  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fencedMatch) {
    return JSON.parse(fencedMatch[1].trim());
  }

  // 2. Try code block without closing fence (truncated response)
  const openFenceMatch = text.match(/```(?:json)?\s*([\s\S]*)/);
  if (openFenceMatch) {
    const partial = openFenceMatch[1].trim();
    // Find the last complete JSON object/array
    const lastBrace = partial.lastIndexOf("}");
    if (lastBrace > 0) {
      return JSON.parse(partial.slice(0, lastBrace + 1));
    }
  }

  // 3. Find first { and last } — raw JSON without fences
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return JSON.parse(text.slice(firstBrace, lastBrace + 1));
  }

  // 4. Last resort — try parsing as-is
  return JSON.parse(text.trim());
}

// Summarize HN stories

interface HNSummaryResult {
  summaries: { id: number; summary: string }[];
}

export async function summarizeHNStories(stories: HNStory[]): Promise<HNStory[]> {
  if (stories.length === 0) return [];

  const storyData = stories.map((s) => ({
    id: s.id,
    title: s.title,
    url: s.url,
  }));

  const prompt = hnSummaryPrompt(storyData);
  const response = await callClaude(prompt);
  const result = parseJSON<HNSummaryResult>(response);

  const summaryMap = new Map(result.summaries.map((s) => [s.id, s.summary]));

  return stories.map((story) => ({
    ...story,
    summary: summaryMap.get(story.id) || story.title,
  }));
}

// Clean up Reddit post titles (remove jargon, shorten rambling titles)

interface RedditTitleResult {
  titles: { id: string; title: string }[];
}

export async function cleanRedditTitles(posts: RedditPost[]): Promise<RedditPost[]> {
  if (posts.length === 0) return [];

  const postData = posts.map((p) => ({
    id: p.id,
    title: p.title,
    subreddit: p.subreddit,
  }));

  const prompt = redditTitleCleanupPrompt(postData);
  const response = await callClaude(prompt);
  const result = parseJSON<RedditTitleResult>(response);

  const titleMap = new Map(result.titles.map((t) => [t.id, t.title]));

  return posts.map((post) => ({
    ...post,
    title: titleMap.get(post.id) || post.title,
  }));
}
