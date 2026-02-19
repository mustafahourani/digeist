import type { HNStory, RedditPost } from "@/lib/types";
import { hnSummaryPrompt, redditTitleCleanupPrompt } from "./prompts";
import { callClaude, parseJSON } from "./client";

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
