import { promises as fs } from "fs";
import path from "path";
import os from "os";
import Anthropic from "@anthropic-ai/sdk";

const WRITING_VOICE_DIR = path.join(os.homedir(), "Projects", "Writing Voice");

interface VoiceContent {
  writingInstructions: string;
  pdfSummaries: { filename: string; content: string }[];
}

async function extractPdfText(filePath: string): Promise<string> {
  try {
    const buffer = await fs.readFile(filePath);
    const base64Content = buffer.toString("base64");

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
              text: "Extract the key principles, rules, and guidelines from this document. Be comprehensive but concise. Return as structured text.",
            },
          ],
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    return textBlock && textBlock.type === "text"
      ? textBlock.text
      : "[Failed to extract PDF content]";
  } catch (err) {
    return `[Error reading PDF: ${err instanceof Error ? err.message : "Unknown error"}]`;
  }
}

export async function loadWritingVoice(): Promise<VoiceContent> {
  // Load Writing Instructions.md
  const instructionsPath = path.join(
    WRITING_VOICE_DIR,
    "Writing Instructions.md"
  );
  let writingInstructions: string;
  try {
    writingInstructions = await fs.readFile(instructionsPath, "utf-8");
  } catch {
    writingInstructions =
      "[Writing Instructions.md not found at ~/Projects/Writing Voice/]";
  }

  // Load all PDFs — run sequentially to avoid rate limits
  const pdfFiles = [
    "First Make Me Care.pdf",
    "X Algorithm tips.pdf",
    // Rajczi Primer is 4.3MB — skip to save tokens/time, rules are in Writing Instructions
  ];

  const pdfSummaries: { filename: string; content: string }[] = [];

  for (const pdfFile of pdfFiles) {
    const pdfPath = path.join(WRITING_VOICE_DIR, pdfFile);
    try {
      await fs.access(pdfPath);
      const content = await extractPdfText(pdfPath);
      pdfSummaries.push({ filename: pdfFile, content });
    } catch {
      pdfSummaries.push({
        filename: pdfFile,
        content: `[${pdfFile} not found or failed to extract]`,
      });
    }
  }

  return { writingInstructions, pdfSummaries };
}

export function formatVoiceForPrompt(voice: VoiceContent): string {
  let prompt = `## Writing Voice Rules\n\n`;
  prompt += `### Writing Instructions\n\n${voice.writingInstructions}\n\n`;

  for (const pdf of voice.pdfSummaries) {
    prompt += `### Reference: ${pdf.filename}\n\n${pdf.content}\n\n`;
  }

  return prompt;
}
