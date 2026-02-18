export type SourceName = "ai_twitter" | "crypto_ai_twitter" | "github" | "hackernews";
export type SourceStatus = "success" | "error" | "skipped";

export interface Tweet {
  id: string;
  author_handle: string;
  author_name: string;
  author_avatar?: string;
  text: string;
  likes: number;
  retweets: number;
  quotes: number;
  views: number;
  url: string;
  created_at: string;
}

export interface Cluster {
  name: string;
  summary: string;
  sentiment_pct: number;
  total_engagement: number;
  tweets: Tweet[];
  cross_sources?: string[];
}

export interface TwitterSection {
  clusters: Cluster[];
  unclustered: Tweet[];
}

export interface GitHubRepo {
  name: string;
  description: string;
  url: string;
  stars: number;
  stars_delta?: number;
  language: string;
  category?: string;
  forks?: number;
  is_trending?: boolean;
  org_tier?: "major" | "known" | "indie";
}

export interface GitHubSection {
  repos: GitHubRepo[];
}

export interface HNStory {
  id: number;
  title: string;
  url: string;
  score: number;
  comments: number;
  summary: string;
  hn_url: string;
  story_type?: "top" | "show_hn" | "ask_hn" | "new_riser";
  domain?: string;
  velocity_score?: number;
}

export interface HNSection {
  stories: HNStory[];
}

export interface DigestSections {
  ai_twitter: TwitterSection;
  crypto_ai_twitter: TwitterSection;
  github: GitHubSection;
  hackernews: HNSection;
}

export interface Digest {
  date: string;
  generated_at: string;
  sources_status: Record<SourceName, SourceStatus>;
  sections: DigestSections;
}

export interface WeeklyTheme {
  name: string;
  summary: string;
  sentiment_avg: number;
  days_appeared: number;
  total_engagement: number;
  representative_tweets: string[];
}

export interface WeeklyDigest {
  week: string;
  start_date: string;
  end_date: string;
  generated_at: string;
  top_themes: WeeklyTheme[];
  source_highlights: {
    ai_twitter: string[];
    crypto_ai_twitter: string[];
    github: string[];
    hackernews: string[];
  };
  week_over_week: string;
}

