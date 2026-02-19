export const SYSTEM_PROMPT = `You are a neutral analyst who summarizes AI industry trends.
You are objective, factual, and never editorialize. You describe what happened and why people care, without hot takes or opinions.
Always respond with valid JSON matching the requested schema exactly.`;

export function hnSummaryPrompt(
  stories: { id: number; title: string; url: string }[]
): string {
  return `Write a clear, informative 1-sentence summary (max 120 chars) for each Hacker News story. Target audience: AI practitioners scanning a daily digest.

RULES:
- Start with what it IS or what HAPPENED — be concrete and specific
- "Anthropic released Claude Sonnet 4.6 with improved coding and agentic capabilities" > "Anthropic announced a new AI model"
- Mention key technical specifics when possible: model names, benchmarks, frameworks, metrics
- If the title already says it clearly, keep it as-is or lightly rephrase
- Don't speculate beyond what the title and URL tell you
- No hype words ("revolutionary", "game-changing", "groundbreaking")
- Factual and neutral tone

Stories:
${JSON.stringify(stories, null, 2)}

Respond with this exact JSON structure:
{
  "summaries": [
    { "id": number, "summary": "One clear factual sentence" }
  ]
}`;
}

export function redditTitleCleanupPrompt(
  posts: { id: string; title: string; subreddit: string }[]
): string {
  return `Clean up these Reddit post titles for a daily AI digest. Many Reddit titles are jargony, rambling, or have unnecessary filler. Rewrite them to be brief and scannable.

RULES:
- If the title is already short and clear, return it AS-IS (don't rewrite for the sake of it)
- Remove filler: "So I just...", "Does anyone else...", "Am I the only one who...", "PSA:", "BREAKING:", "[D]", "[P]", "[R]", etc.
- Shorten long rambling titles to their core point (max ~120 chars — two lines is fine)
- Keep technical specifics: model names, tool names, frameworks
- Don't editorialize or add opinions — just clean up
- Preserve the meaning exactly — don't change what it's about
- No hype words, no emojis

Posts:
${JSON.stringify(posts, null, 2)}

Respond with this exact JSON structure:
{
  "titles": [
    { "id": "string", "title": "cleaned up title" }
  ]
}`;
}
