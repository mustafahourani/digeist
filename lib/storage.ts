import { promises as fs } from "fs";
import path from "path";
import type { Digest } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const DIGESTS_DIR = path.join(DATA_DIR, "digests");

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

export async function saveDigest(digest: Digest): Promise<void> {
  await ensureDir(DIGESTS_DIR);
  const filePath = path.join(DIGESTS_DIR, `${digest.date}.json`);
  await fs.writeFile(filePath, JSON.stringify(digest, null, 2));
}

export async function getDigest(date: string): Promise<Digest | null> {
  const filePath = path.join(DIGESTS_DIR, `${date}.json`);
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content) as Digest;
  } catch {
    return null;
  }
}

export async function listDigestDates(): Promise<string[]> {
  await ensureDir(DIGESTS_DIR);
  const files = await fs.readdir(DIGESTS_DIR);
  return files
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(".json", ""))
    .sort()
    .reverse();
}
