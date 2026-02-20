import Anthropic from "@anthropic-ai/sdk";
import { promises as fs } from "fs";
import path from "path";

const DIGESTS_DIR = path.join(process.cwd(), "data", "digests");

export const readDigestTool: Anthropic.Tool = {
  name: "read_digest",
  description:
    "Read a daily digest JSON file by date. Returns the full digest object with GitHub repos, Hacker News stories, and Reddit posts.",
  input_schema: {
    type: "object" as const,
    properties: {
      date: {
        type: "string",
        description: "The date of the digest in YYYY-MM-DD format",
      },
    },
    required: ["date"],
  },
};

export async function executeReadDigest(input: {
  date: string;
}): Promise<string> {
  const filePath = path.join(DIGESTS_DIR, `${input.date}.json`);
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return content;
  } catch {
    return JSON.stringify({
      error: `No digest found for date ${input.date}. File not found at ${filePath}`,
    });
  }
}
