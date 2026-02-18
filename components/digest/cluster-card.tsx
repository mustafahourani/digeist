"use client";

import { useState } from "react";
import { SentimentBar } from "./sentiment-bar";
import { TweetEmbed } from "./tweet-embed";
import { formatEngagement, NON_LATIN_RE } from "@/lib/utils";
import type { Cluster, Tweet } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ClusterCardProps {
  cluster: Cluster;
}

function isLikelyEnglish(tweet: Tweet): boolean {
  const cleaned = tweet.text
    .replace(/https?:\/\/\S+/g, "")
    .replace(/@\w+/g, "")
    .replace(/#\w+/g, "")
    .trim();
  return !NON_LATIN_RE.test(cleaned);
}

export function ClusterCard({ cluster }: ClusterCardProps) {
  const [open, setOpen] = useState(false);
  const visibleTweets = cluster.tweets.filter((t) => isLikelyEnglish(t));
  const tweetCount = visibleTweets.length;

  return (
    <>
      <div className="rounded-xl border border-border bg-card overflow-hidden h-full flex flex-col">
        <div className="p-5 flex-1">
          <div className="flex items-start justify-between gap-3 mb-2">
            <h3 className="text-[17px] font-semibold leading-snug">{cluster.name}</h3>
            <span className="text-[13px] text-muted-foreground tabular-nums shrink-0 mt-0.5">
              {formatEngagement(cluster.total_engagement)}
            </span>
          </div>

          <div className="flex items-center gap-4 mb-3">
            <SentimentBar percentage={cluster.sentiment_pct} />
          </div>

          <p className="text-[15px] text-muted-foreground leading-[1.6]">
            {cluster.summary}
          </p>

          {cluster.cross_sources && cluster.cross_sources.length > 0 && (
            <div className="flex items-center gap-1.5 mt-3">
              <span className="text-[11px] text-muted-foreground/60 uppercase tracking-wide font-medium">
                Also in
              </span>
              {cluster.cross_sources.map((source) => (
                <span
                  key={source}
                  className="text-[11px] font-medium text-muted-foreground bg-foreground/[0.05] px-2 py-0.5 rounded-full"
                >
                  {source}
                </span>
              ))}
            </div>
          )}
        </div>

        {tweetCount > 0 && (
          <button
            onClick={() => setOpen(true)}
            className="w-full py-2.5 border-t border-border text-[13px] font-medium text-muted-foreground bg-foreground/[0.06] hover:bg-foreground/[0.1] hover:text-foreground transition-colors"
          >
            View {tweetCount} tweet{tweetCount !== 1 ? "s" : ""}
          </button>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[17px] leading-snug pr-6">
              {cluster.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            {visibleTweets.map((tweet) => (
              <TweetEmbed key={tweet.id} tweet={tweet} />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
