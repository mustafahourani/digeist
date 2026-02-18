import { promises as fs } from "fs";
import path from "path";
import type { Digest, WeeklyDigest } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const DIGESTS_DIR = path.join(DATA_DIR, "digests");
const WEEKLY_DIR = path.join(DATA_DIR, "weekly");
async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

// Daily digests

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

// Weekly digests

export async function saveWeeklyDigest(digest: WeeklyDigest): Promise<void> {
  await ensureDir(WEEKLY_DIR);
  const filePath = path.join(WEEKLY_DIR, `${digest.week}.json`);
  await fs.writeFile(filePath, JSON.stringify(digest, null, 2));
}

export async function getWeeklyDigest(week: string): Promise<WeeklyDigest | null> {
  const filePath = path.join(WEEKLY_DIR, `${week}.json`);
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content) as WeeklyDigest;
  } catch {
    return null;
  }
}

export async function listWeeklyDigests(): Promise<string[]> {
  await ensureDir(WEEKLY_DIR);
  const files = await fs.readdir(WEEKLY_DIR);
  return files
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(".json", ""))
    .sort()
    .reverse();
}

// Get digests for a date range (for weekly rollup)

export async function getDigestsForRange(startDate: string, endDate: string): Promise<Digest[]> {
  const dates = await listDigestDates();
  const inRange = dates.filter((d) => d >= startDate && d <= endDate);
  const digests: Digest[] = [];
  for (const date of inRange) {
    const digest = await getDigest(date);
    if (digest) digests.push(digest);
  }
  return digests;
}
