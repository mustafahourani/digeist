"use client";

import { useState } from "react";
import { ClusterCard } from "./cluster-card";
import { GitHubItem } from "./github-item";
import { HNItem } from "./hn-item";
import { SourceError } from "./source-error";
import { SectionNav, type SectionId } from "@/components/nav/section-nav";
import type { Digest, GitHubRepo } from "@/lib/types";
import { NON_LATIN_RE } from "@/lib/utils";

const SECTION_CAP = 12;

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
  const [activeTab, setActiveTab] = useState<SectionId>("ai-twitter");

  return (
    <div>
      <SectionNav activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="mt-6">
        {/* AI Twitter */}
        {activeTab === "ai-twitter" && (
          <section>
            {sources_status.ai_twitter === "error" ? (
              <SourceError source="AI Twitter" />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sections.ai_twitter.clusters
                  .slice(0, SECTION_CAP)
                  .map((cluster, i) => (
                    <ClusterCard key={i} cluster={cluster} />
                  ))}
              </div>
            )}
          </section>
        )}

        {/* Crypto/AI Twitter */}
        {activeTab === "crypto-twitter" && (
          <section>
            {sources_status.crypto_ai_twitter === "error" ? (
              <SourceError source="Crypto/AI Twitter" />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sections.crypto_ai_twitter.clusters
                  .slice(0, SECTION_CAP)
                  .map((cluster, i) => (
                    <ClusterCard key={i} cluster={cluster} />
                  ))}
              </div>
            )}
          </section>
        )}

        {/* GitHub Trending */}
        {activeTab === "github" && (
          <section>
            {sources_status.github === "error" ? (
              <SourceError source="GitHub Trending" />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sections.github.repos
                  .filter((r) => isLikelyEnglishRepo(r))
                  .slice(0, SECTION_CAP)
                  .map((repo, i) => (
                    <GitHubItem key={i} repo={repo} />
                  ))}
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sections.hackernews.stories
                  .slice(0, SECTION_CAP)
                  .map((story) => (
                    <HNItem key={story.id} story={story} />
                  ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
