"use client";

import { useState } from "react";
import { GitHubItem } from "./github-item";
import { HNItem } from "./hn-item";
import { RedditItem } from "./reddit-item";
import { SourceError } from "./source-error";
import { SectionNav, type SectionId } from "@/components/nav/section-nav";
import type { Digest, GitHubRepo } from "@/lib/types";
import { NON_LATIN_RE } from "@/lib/utils";
import { Flame, TrendingUp } from "lucide-react";

function isLikelyEnglishRepo(repo: GitHubRepo): boolean {
  const text = repo.description || repo.name;
  const cleaned = text
    .replace(/https?:\/\/\S+/g, "")
    .trim();
  return !NON_LATIN_RE.test(cleaned);
}

interface DigestPageProps {
  digest: Digest;
}

export function DigestPage({ digest }: DigestPageProps) {
  const { sections, sources_status } = digest;
  const [activeTab, setActiveTab] = useState<SectionId>("github");

  return (
    <div>
      <SectionNav activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="mt-6">
        {/* GitHub */}
        {activeTab === "github" && (
          <section>
            {sources_status.github === "error" ? (
              <SourceError source="GitHub" />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Hottest Today — created in last 24h */}
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Flame className="h-4 w-4 text-orange-500" />
                    Hottest Today
                  </h3>
                  <div className="flex flex-col gap-3">
                    {sections.github.new_repos
                      .filter((r) => isLikelyEnglishRepo(r))
                      .slice(0, 10)
                      .map((repo, i) => (
                        <GitHubItem key={`new-${i}`} repo={repo} />
                      ))}
                    {sections.github.new_repos.length === 0 && (
                      <p className="text-sm text-muted-foreground">No hot repos today.</p>
                    )}
                  </div>
                </div>

                {/* Hottest This Week */}
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                    Hottest This Week
                  </h3>
                  <div className="flex flex-col gap-3">
                    {sections.github.trending_repos
                      .filter((r) => isLikelyEnglishRepo(r))
                      .slice(0, 10)
                      .map((repo, i) => (
                        <GitHubItem key={`trend-${i}`} repo={repo} />
                      ))}
                    {sections.github.trending_repos.length === 0 && (
                      <p className="text-sm text-muted-foreground">No hot repos this week yet.</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Hacker News */}
        {activeTab === "hackernews" && (
          <section>
            {sources_status.hackernews === "error" ? (
              <SourceError source="Hacker News" />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Hottest Today */}
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Flame className="h-4 w-4 text-orange-500" />
                    Hottest Today
                  </h3>
                  <div className="flex flex-col gap-3">
                    {sections.hackernews.hot_stories
                      .slice(0, 10)
                      .map((story) => (
                        <HNItem key={`hot-${story.id}`} story={story} />
                      ))}
                    {sections.hackernews.hot_stories.length === 0 && (
                      <p className="text-sm text-muted-foreground">No hot stories today.</p>
                    )}
                  </div>
                </div>

                {/* Hottest This Week */}
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                    Hottest This Week
                  </h3>
                  <div className="flex flex-col gap-3">
                    {sections.hackernews.rising_stories
                      .slice(0, 10)
                      .map((story) => (
                        <HNItem key={`rising-${story.id}`} story={story} />
                      ))}
                    {sections.hackernews.rising_stories.length === 0 && (
                      <p className="text-sm text-muted-foreground">No hot stories this week yet.</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Reddit */}
        {activeTab === "reddit" && (
          <section>
            {sources_status.reddit === "error" ? (
              <SourceError source="Reddit" />
            ) : !sections.reddit ? (
              <p className="text-sm text-muted-foreground">No Reddit data available for this digest.</p>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Hottest Today */}
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Flame className="h-4 w-4 text-orange-500" />
                    Hottest Today
                  </h3>
                  <div className="flex flex-col gap-3">
                    {sections.reddit.hot_posts
                      .slice(0, 10)
                      .map((post) => (
                        <RedditItem key={`hot-${post.id}`} post={post} />
                      ))}
                    {sections.reddit.hot_posts.length === 0 && (
                      <p className="text-sm text-muted-foreground">No hot posts today.</p>
                    )}
                  </div>
                </div>

                {/* Hottest This Week */}
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                    Hottest This Week
                  </h3>
                  <div className="flex flex-col gap-3">
                    {sections.reddit.rising_posts
                      .slice(0, 10)
                      .map((post) => (
                        <RedditItem key={`rising-${post.id}`} post={post} />
                      ))}
                    {sections.reddit.rising_posts.length === 0 && (
                      <p className="text-sm text-muted-foreground">No hot posts this week yet.</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
