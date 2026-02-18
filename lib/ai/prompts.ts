export const SYSTEM_PROMPT = `You are a neutral analyst who summarizes AI industry trends.
You are objective, factual, and never editorialize. You describe what happened and why people care, without hot takes or opinions.
Always respond with valid JSON matching the requested schema exactly.`;

export function clusterPrompt(
  tweets: { id: string; text: string; likes: number; retweets: number; quotes: number }[],
  section: "AI" | "AI x Crypto"
): string {
  return `You are analyzing ${tweets.length} tweets from the past 24 hours about ${section}.

Group these tweets into clusters based on the theme, event, or discourse they reference. Cluster names should capture the specific conversation happening that day.

Most clusters will be focused themes (e.g., "Open Source vs Closed Model Debate", "AI Coding Tools Comparison Wave"). When a specific project or launch genuinely dominated the conversation, name the cluster after it (e.g., "Gemini 3.0 Launch").

Avoid overly broad names like "AI News" or "Various Updates." The cluster name should make someone immediately understand what conversation was happening that day.

For each cluster:
1. Name: Focused, descriptive theme name
2. Summary: 2-4 neutral, factual sentences describing what the cluster is about and why people care
3. Sentiment: Percentage of positive sentiment (0-100). Be granular - there's a big difference between 55% and 90%.
4. Representative tweets: Pick 2-3 tweet IDs that best represent this cluster
5. Total engagement: Sum of likes + retweets + quotes for all tweets in the cluster

Tweets that don't fit any cluster should be listed separately as "unclustered" with just their IDs.

Here are the tweets:
${JSON.stringify(tweets, null, 2)}

Respond with this exact JSON structure:
{
  "clusters": [
    {
      "name": "string",
      "summary": "string",
      "sentiment_pct": number,
      "total_engagement": number,
      "tweet_ids": ["id1", "id2", "id3"]
    }
  ],
  "unclustered_ids": ["id1", "id2"]
}`;
}

export function hnSummaryPrompt(
  stories: { id: number; title: string; url: string }[]
): string {
  return `Generate a one-line neutral summary for each of these Hacker News stories. Each summary should explain what the story is about in a single sentence, factually and without opinion.

Stories:
${JSON.stringify(stories, null, 2)}

Respond with this exact JSON structure:
{
  "summaries": [
    { "id": number, "summary": "One factual sentence about the story" }
  ]
}`;
}

