import Anthropic from "@anthropic-ai/sdk";
import { readDigestTool, executeReadDigest } from "./read-digest";
import { listDigestsTool, executeListDigests } from "./list-digests";
import { readFileTool, executeReadFile } from "./read-file";
import { writeFileTool, executeWriteFile } from "./write-file";
import { webSearchTool, executeWebSearch } from "./web-search";
import { readPdfTool, executeReadPdf } from "./read-pdf";

export const allTools: Anthropic.Tool[] = [
  readDigestTool,
  listDigestsTool,
  readFileTool,
  writeFileTool,
  webSearchTool,
  readPdfTool,
];

export async function executeTool(
  name: string,
  input: Record<string, unknown>
): Promise<string> {
  switch (name) {
    case "read_digest":
      return executeReadDigest(input as { date: string });
    case "list_digests":
      return executeListDigests(input as { limit?: number });
    case "read_file":
      return executeReadFile(input as { path: string });
    case "write_file":
      return executeWriteFile(input as { path: string; content: string });
    case "web_search":
      return executeWebSearch(input as { query: string });
    case "read_pdf":
      return executeReadPdf(input as { path: string });
    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}
