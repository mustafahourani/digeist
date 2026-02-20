import Anthropic from "@anthropic-ai/sdk";
import { allTools, executeTool } from "./tools";
import { buildSystemPrompt } from "./prompts/system";

const MODEL = "claude-opus-4-6";
const MAX_TOKENS = 16384;
const MAX_TURNS = 25;
const MAX_RETRIES = 5;

export interface AgentResult {
  success: boolean;
  finalText: string;
  turns: number;
  inputTokens: number;
  outputTokens: number;
}

async function callWithRetry(
  client: Anthropic,
  params: Anthropic.MessageCreateParamsNonStreaming
): Promise<Anthropic.Message> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await client.messages.create(params);
    } catch (err: unknown) {
      const isRateLimit =
        err instanceof Anthropic.RateLimitError ||
        (err instanceof Error && err.message.includes("rate_limit"));
      const isOverloaded =
        err instanceof Anthropic.APIError &&
        (err.status === 529 || err.message.includes("overloaded"));

      if ((isRateLimit || isOverloaded) && attempt < MAX_RETRIES - 1) {
        // Parse retry-after header or use exponential backoff
        const waitSeconds = Math.min(30, Math.pow(2, attempt + 1)) + Math.random() * 2;
        console.log(`  Rate limited. Waiting ${waitSeconds.toFixed(0)}s before retry ${attempt + 2}/${MAX_RETRIES}...`);
        await new Promise((r) => setTimeout(r, waitSeconds * 1000));
        continue;
      }
      throw err;
    }
  }
  throw new Error("Max retries exceeded");
}

export async function runAgent(userPrompt: string): Promise<AgentResult> {
  const client = new Anthropic();

  // Build system prompt with voice, preferences, and patterns
  console.log("  Loading system prompt (voice, preferences, patterns)...");
  const systemPrompt = await buildSystemPrompt();

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: userPrompt },
  ];

  let turns = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  while (turns < MAX_TURNS) {
    turns++;
    console.log(`  Turn ${turns}/${MAX_TURNS}...`);

    const response = await callWithRetry(client, {
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      tools: allTools,
      messages,
    });

    // Track token usage
    if (response.usage) {
      totalInputTokens += response.usage.input_tokens;
      totalOutputTokens += response.usage.output_tokens;
    }

    // Add assistant response to conversation
    messages.push({
      role: "assistant",
      content: response.content,
    });

    // Log any text output
    for (const block of response.content) {
      if (block.type === "text" && block.text.trim()) {
        console.log(`  Agent: ${block.text.slice(0, 200)}${block.text.length > 200 ? "..." : ""}`);
      }
    }

    // If done, extract final text
    if (response.stop_reason === "end_turn") {
      const finalText = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("\n");

      return {
        success: true,
        finalText,
        turns,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
      };
    }

    // Process tool calls
    if (response.stop_reason === "tool_use") {
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of response.content) {
        if (block.type === "tool_use") {
          console.log(`  Tool: ${block.name}(${JSON.stringify(block.input).slice(0, 100)})`);

          try {
            const result = await executeTool(
              block.name,
              block.input as Record<string, unknown>
            );
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: result,
            });
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : "Unknown error";
            console.error(`  Tool error: ${block.name} — ${errorMsg}`);
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: JSON.stringify({ error: errorMsg }),
              is_error: true,
            });
          }
        }
      }

      // Feed tool results back
      messages.push({
        role: "user",
        content: toolResults,
      });
    }
  }

  // Max turns exceeded
  return {
    success: false,
    finalText: "Agent exceeded maximum turn limit.",
    turns,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
  };
}
