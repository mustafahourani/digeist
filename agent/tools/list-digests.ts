import Anthropic from "@anthropic-ai/sdk";
import { promises as fs } from "fs";
import path from "path";

const DIGESTS_DIR = path.join(process.cwd(), "data", "digests");

export const listDigestsTool: Anthropic.Tool = {
  name: "list_digests",
  description:
    "List all available digest dates, sorted newest first. Optionally limit the number of results.",
  input_schema: {
    type: "object" as const,
    properties: {
      limit: {
        type: "number",
        description:
          "Maximum number of dates to return. Defaults to 30 if not specified.",
      },
    },
    required: [],
  },
};

export async function executeListDigests(input: {
  limit?: number;
}): Promise<string> {
  try {
    await fs.mkdir(DIGESTS_DIR, { recursive: true });
    const files = await fs.readdir(DIGESTS_DIR);
    const dates = files
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(".json", ""))
      .sort()
      .reverse()
      .slice(0, input.limit ?? 30);
    return JSON.stringify({ dates, count: dates.length });
  } catch (err) {
    return JSON.stringify({
      error: `Failed to list digests: ${err instanceof Error ? err.message : "Unknown error"}`,
    });
  }
}
