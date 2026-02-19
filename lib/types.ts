export type SourceName = "github" | "hackernews" | "reddit";
export type SourceStatus = "success" | "error" | "skipped";

export interface GitHubRepo {
  name: string;
  description: string;
  url: string;
  stars: number;
  stars_delta?: number;
  language: string;
  category?: string;
  forks?: number;
  forks_delta?: number;
  is_trending?: boolean;
  org_tier?: "major" | "known" | "indie";
  created_at?: string;
}

export interface GitHubSection {
  new_repos: GitHubRepo[];
  trending_repos: GitHubRepo[];
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
  score_delta?: number;
  comments_delta?: number;
  created_at?: string;
}

export interface HNSection {
  hot_stories: HNStory[];
  rising_stories: HNStory[];
}

export interface RedditPost {
  id: string;
  title: string;
  url: string;
  score: number;
  comments: number;
  summary: string;
  reddit_url: string;
  subreddit: string;
  author: string;
  domain: string;
  is_self: boolean;
  upvote_ratio: number;
  post_type?: "link" | "self";
  velocity_score?: number;
  score_delta?: number;
  comments_delta?: number;
  created_at?: string;
  flair?: string;
}

export interface RedditSection {
  hot_posts: RedditPost[];
  rising_posts: RedditPost[];
}

export interface DigestSections {
  github: GitHubSection;
  hackernews: HNSection;
  reddit: RedditSection;
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
    github: string[];
    hackernews: string[];
    reddit: string[];
  };
  week_over_week: string;
}
