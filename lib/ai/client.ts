import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT } from "./prompts";

export const MODEL = "claude-sonnet-4-5-20250929";

export function getClient(): Anthropic {
  return new Anthropic();
}

export async function callClaude(prompt: string): Promise<string> {
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

export function parseJSON<T>(text: string): T {
  // 1. Try markdown code block (with closing fence)
  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fencedMatch) {
    return JSON.parse(fencedMatch[1].trim());
  }

  // 2. Try code block without closing fence (truncated response)
  const openFenceMatch = text.match(/```(?:json)?\s*([\s\S]*)/);
  if (openFenceMatch) {
    const partial = openFenceMatch[1].trim();
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
