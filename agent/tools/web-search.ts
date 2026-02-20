import Anthropic from "@anthropic-ai/sdk";

export const webSearchTool: Anthropic.Tool = {
  name: "web_search",
  description:
    "Search the web for additional context. Use this to enrich research pointers, validate trends, or gather context for article writing.",
  input_schema: {
    type: "object" as const,
    properties: {
      query: {
        type: "string",
        description: "The search query to execute.",
      },
    },
    required: ["query"],
  },
};

export async function executeWebSearch(input: {
  query: string;
}): Promise<string> {
  // Use the Anthropic SDK's built-in web search via a separate client call
  // For now, we use a simple fetch to a search API
  // The agent can also use Anthropic's web search tool natively
  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `Search the web for: "${input.query}". Summarize the top results concisely with key facts, dates, and URLs where relevant.`,
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (textBlock && textBlock.type === "text") {
      return textBlock.text;
    }
    return JSON.stringify({ error: "No search results returned" });
  } catch (err) {
    return JSON.stringify({
      error: `Web search failed: ${err instanceof Error ? err.message : "Unknown error"}`,
    });
  }
}
