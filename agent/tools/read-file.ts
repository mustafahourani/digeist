import Anthropic from "@anthropic-ai/sdk";
import { promises as fs } from "fs";
import path from "path";
import os from "os";

const PROJECT_ROOT = process.cwd();
const WRITING_VOICE_DIR = path.join(os.homedir(), "Projects", "Writing Voice");

// Allowed directories the agent can read from
const ALLOWED_PREFIXES = [
  path.join(PROJECT_ROOT, "data"),
  path.join(PROJECT_ROOT, "agent"),
  path.join(PROJECT_ROOT, "config"),
  WRITING_VOICE_DIR,
];

export const readFileTool: Anthropic.Tool = {
  name: "read_file",
  description:
    "Read any file from the agent's output directory, data directory, config directory, or the Writing Voice folder. Use relative paths from project root (e.g. 'agent/Preferences.json') or absolute paths within allowed directories.",
  input_schema: {
    type: "object" as const,
    properties: {
      path: {
        type: "string",
        description:
          "Path to the file. Relative paths are resolved from the project root. Supports ~ for home directory.",
      },
    },
    required: ["path"],
  },
};

function resolvePath(inputPath: string): string {
  // Expand ~ to home directory
  if (inputPath.startsWith("~/") || inputPath === "~") {
    return path.join(os.homedir(), inputPath.slice(1));
  }
  // If absolute, use as-is
  if (path.isAbsolute(inputPath)) {
    return inputPath;
  }
  // Relative paths resolve from project root
  return path.join(PROJECT_ROOT, inputPath);
}

export async function executeReadFile(input: {
  path: string;
}): Promise<string> {
  const resolved = resolvePath(input.path);

  // Security check: only read from allowed directories
  const isAllowed = ALLOWED_PREFIXES.some((prefix) =>
    resolved.startsWith(prefix)
  );
  if (!isAllowed) {
    return JSON.stringify({
      error: `Access denied. Can only read from: agent/, data/, config/, or ~/Projects/Writing Voice/. Requested: ${input.path}`,
    });
  }

  try {
    const content = await fs.readFile(resolved, "utf-8");
    return content;
  } catch {
    return JSON.stringify({
      error: `File not found: ${input.path} (resolved to ${resolved})`,
    });
  }
}
