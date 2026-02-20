import { promises as fs } from "fs";
import path from "path";

const PATTERNS_PATH = path.join(
  process.cwd(),
  "data",
  "agent",
  "patterns.json"
);

export interface ActivePattern {
  topic: string;
  first_seen: string;
  last_seen: string;
  days_appeared: number;
  sources: string[];
  trajectory: "accelerating" | "steady" | "decelerating" | "new";
  observation: string;
  actionable: boolean;
  suggested_action: string;
}

export interface ExpiredPattern {
  topic: string;
  first_seen: string;
  last_seen: string;
  days_appeared: number;
  expired_reason: string;
}

export interface PatternState {
  active_patterns: ActivePattern[];
  expired_patterns: ExpiredPattern[];
}

const DEFAULT_STATE: PatternState = {
  active_patterns: [],
  expired_patterns: [],
};

export async function loadPatterns(): Promise<PatternState> {
  try {
    const content = await fs.readFile(PATTERNS_PATH, "utf-8");
    return JSON.parse(content) as PatternState;
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export async function savePatterns(state: PatternState): Promise<void> {
  await fs.mkdir(path.dirname(PATTERNS_PATH), { recursive: true });
  await fs.writeFile(PATTERNS_PATH, JSON.stringify(state, null, 2), "utf-8");
}

export function formatPatternsForPrompt(state: PatternState): string {
  if (state.active_patterns.length === 0) {
    return `## Active Patterns\n\nNo active patterns tracked yet. Patterns emerge after 2+ consecutive days of a topic appearing in digests.`;
  }

  let prompt = `## Active Patterns\n\n`;
  for (const p of state.active_patterns) {
    prompt += `### ${p.topic}\n`;
    prompt += `- **First seen:** ${p.first_seen} | **Last seen:** ${p.last_seen} | **Days:** ${p.days_appeared}\n`;
    prompt += `- **Sources:** ${p.sources.join(", ")}\n`;
    prompt += `- **Trajectory:** ${p.trajectory}\n`;
    prompt += `- **Observation:** ${p.observation}\n`;
    prompt += `- **Actionable:** ${p.actionable ? "Yes" : "No"}`;
    if (p.actionable) prompt += ` — ${p.suggested_action}`;
    prompt += `\n\n`;
  }

  if (state.expired_patterns.length > 0) {
    prompt += `### Recently Expired\n`;
    for (const p of state.expired_patterns.slice(-3)) {
      prompt += `- ${p.topic} (${p.first_seen} to ${p.last_seen}, ${p.days_appeared} days) — ${p.expired_reason}\n`;
    }
  }

  return prompt;
}
