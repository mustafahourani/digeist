import Anthropic from "@anthropic-ai/sdk";
import { promises as fs } from "fs";
import path from "path";

const PROJECT_ROOT = process.cwd();

// Allowed output directories
const ALLOWED_PREFIXES = [path.join(PROJECT_ROOT, "agent")];

export const writeFileTool: Anthropic.Tool = {
  name: "write_file",
  description:
    "Write a file to the agent's output directories (agent/). Use relative paths from project root.",
  input_schema: {
    type: "object" as const,
    properties: {
      path: {
        type: "string",
        description:
          "Path to write the file. Relative paths resolve from project root. Must be within agent/.",
      },
      content: {
        type: "string",
        description: "The content to write to the file.",
      },
    },
    required: ["path", "content"],
  },
};

export async function executeWriteFile(input: {
  path: string;
  content: string;
}): Promise<string> {
  const resolved = path.isAbsolute(input.path)
    ? input.path
    : path.join(PROJECT_ROOT, input.path);

  // Security check: only write to agent output directories
  const isAllowed = ALLOWED_PREFIXES.some((prefix) =>
    resolved.startsWith(prefix)
  );
  if (!isAllowed) {
    return JSON.stringify({
      error: `Access denied. Can only write to: agent/. Requested: ${input.path}`,
    });
  }

  try {
    await fs.mkdir(path.dirname(resolved), { recursive: true });
    await fs.writeFile(resolved, input.content, "utf-8");
    return JSON.stringify({
      success: true,
      path: input.path,
      bytes: Buffer.byteLength(input.content, "utf-8"),
    });
  } catch (err) {
    return JSON.stringify({
      error: `Failed to write file: ${err instanceof Error ? err.message : "Unknown error"}`,
    });
  }
}
