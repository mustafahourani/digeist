import { promises as fs } from "fs";
import path from "path";

const PREFS_PATH = path.join(
  process.cwd(),
  "data",
  "agent",
  "preferences.json"
);

export interface Preferences {
  last_updated: string;
  topic_weights: Record<string, number>;
  voice_learnings: string[];
  source_quality: Record<
    string,
    { signal_score: number; notes: string }
  >;
  content_preferences: string[];
  pipeline_learnings: {
    source_noise_log: Array<{
      source: string;
      subreddit?: string;
      noise_count: number;
      signal_count: number;
      recommendation: string;
    }>;
    threshold_observations: string[];
    missing_coverage: string[];
  };
  feedback_history_count: number;
}

const DEFAULT_PREFERENCES: Preferences = {
  last_updated: new Date().toISOString().split("T")[0],
  topic_weights: {},
  voice_learnings: [],
  source_quality: {},
  content_preferences: [],
  pipeline_learnings: {
    source_noise_log: [],
    threshold_observations: [],
    missing_coverage: [],
  },
  feedback_history_count: 0,
};

export async function loadPreferences(): Promise<Preferences> {
  try {
    const content = await fs.readFile(PREFS_PATH, "utf-8");
    return JSON.parse(content) as Preferences;
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export async function savePreferences(prefs: Preferences): Promise<void> {
  prefs.last_updated = new Date().toISOString().split("T")[0];
  await fs.mkdir(path.dirname(PREFS_PATH), { recursive: true });
  await fs.writeFile(PREFS_PATH, JSON.stringify(prefs, null, 2), "utf-8");
}

export function formatPreferencesForPrompt(prefs: Preferences): string {
  return `## Current Preferences & Scoring Rubric

**Last updated:** ${prefs.last_updated}
**Total feedback sessions:** ${prefs.feedback_history_count}

### Topic Weights
${Object.entries(prefs.topic_weights).length > 0 ? Object.entries(prefs.topic_weights).map(([topic, weight]) => `- ${topic}: ${weight}`).join("\n") : "No topic weights set yet. Will calibrate from feedback."}

### Voice Learnings
${prefs.voice_learnings.length > 0 ? prefs.voice_learnings.map((l) => `- ${l}`).join("\n") : "No voice learnings yet. Will calibrate from feedback."}

### Source Quality Assessment
${Object.entries(prefs.source_quality).length > 0 ? Object.entries(prefs.source_quality).map(([source, data]) => `- ${source}: ${data.signal_score} — ${data.notes}`).join("\n") : "No source assessments yet."}

### Content Preferences
${prefs.content_preferences.length > 0 ? prefs.content_preferences.map((p) => `- ${p}`).join("\n") : "No content preferences recorded yet."}

### Pipeline Learnings
${prefs.pipeline_learnings.threshold_observations.length > 0 ? "**Threshold observations:**\n" + prefs.pipeline_learnings.threshold_observations.map((o) => `- ${o}`).join("\n") : ""}
${prefs.pipeline_learnings.missing_coverage.length > 0 ? "\n**Coverage gaps:**\n" + prefs.pipeline_learnings.missing_coverage.map((m) => `- ${m}`).join("\n") : ""}`;
}
