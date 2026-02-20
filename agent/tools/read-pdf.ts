import Anthropic from "@anthropic-ai/sdk";
import { promises as fs } from "fs";
import path from "path";
import os from "os";

const WRITING_VOICE_DIR = path.join(os.homedir(), "Desktop", "Writing Voice");

export const readPdfTool: Anthropic.Tool = {
  name: "read_pdf",
  description:
    "Read a PDF file and extract text content. Primarily used for loading Writing Voice reference PDFs.",
  input_schema: {
    type: "object" as const,
    properties: {
      path: {
        type: "string",
        description:
          "Path to the PDF file. Supports ~ for home directory expansion.",
      },
    },
    required: ["path"],
  },
};

function resolvePath(inputPath: string): string {
  if (inputPath.startsWith("~/") || inputPath === "~") {
    return path.join(os.homedir(), inputPath.slice(1));
  }
  if (path.isAbsolute(inputPath)) {
    return inputPath;
  }
  return path.join(process.cwd(), inputPath);
}

export async function executeReadPdf(input: {
  path: string;
}): Promise<string> {
  const resolved = resolvePath(input.path);

  // Security check: only allow PDFs from Writing Voice directory
  if (!resolved.startsWith(WRITING_VOICE_DIR)) {
    return JSON.stringify({
      error: `Access denied. Can only read PDFs from ~/Desktop/Writing Voice/. Requested: ${input.path}`,
    });
  }

  try {
    const buffer = await fs.readFile(resolved);
    const base64Content = buffer.toString("base64");

    // Use Anthropic's PDF reading capability via the API
    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: base64Content,
              },
            },
            {
              type: "text",
              text: "Extract and return the full text content of this PDF. Preserve the structure, headings, and key points. Return the content as-is without summarizing.",
            },
          ],
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (textBlock && textBlock.type === "text") {
      return textBlock.text;
    }
    return JSON.stringify({ error: "Failed to extract PDF content" });
  } catch (err) {
    return JSON.stringify({
      error: `Failed to read PDF: ${err instanceof Error ? err.message : "Unknown error"}`,
    });
  }
}
