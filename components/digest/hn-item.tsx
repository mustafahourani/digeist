import { ExternalLink, MessageSquare, Clock, ThumbsUp } from "lucide-react";
import type { HNStory } from "@/lib/types";
import { extractDomain, formatEngagement } from "@/lib/utils";

function storyAge(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return "just now";
  if (hours === 1) return "1h ago";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "1d ago";
  return `${days}d ago`;
}

interface HNItemProps {
  story: HNStory;
}

export function HNItem({ story }: HNItemProps) {
  const domain = extractDomain(story.url);
  const hasExternalUrl = story.url !== story.hn_url;
  const hasScoreDelta = story.score_delta != null && story.score_delta > 0;
  const hasCommentsDelta = story.comments_delta != null && story.comments_delta > 0;

  return (
    <a
      href={story.hn_url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex flex-col h-[160px] rounded-lg border border-border bg-card hover:border-foreground/15 transition-colors"
    >
      <div className="flex flex-col flex-1 p-4 min-h-0">
        {/* Title — clamped to 2 lines */}
        <span className="text-[15px] font-semibold leading-snug line-clamp-2 mb-1">
          {story.title}
        </span>

        {/* Summary or domain — fills middle space */}
        <p className="text-[13px] text-muted-foreground leading-[1.5] mb-auto line-clamp-2">
          {story.summary || domain}
        </p>

        {/* Bottom row: date + article left, stats right */}
        <div className="flex items-end justify-between pt-2">
          {/* Left: creation date + original article */}
          <div className="flex items-center gap-2">
            {story.created_at && (
              <span className="flex items-center gap-1 text-[12px] text-muted-foreground">
                <Clock className="h-3 w-3" />
                {storyAge(story.created_at)}
              </span>
            )}
            {hasExternalUrl && domain && (
              <span
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  window.open(story.url, "_blank", "noopener,noreferrer");
                }}
                className="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted px-2.5 py-1 rounded-full transition-colors cursor-pointer truncate"
              >
                <ExternalLink className="h-3 w-3 shrink-0" />
                Original Article
              </span>
            )}
          </div>

          {/* Right: upvotes + comments columns */}
          <div className="flex items-end gap-2">
            {/* Upvotes column */}
            <div className="flex flex-col items-center gap-0.5">
              {hasScoreDelta && (
                <span className="text-[12px] font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  +{formatEngagement(story.score_delta!)}
                </span>
              )}
              <span className="inline-flex items-center justify-center gap-1 min-w-[4rem] text-[12px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full">
                <ThumbsUp className="h-3 w-3" />
                {formatEngagement(story.score)}
              </span>
            </div>
            {/* Comments column */}
            <div className="flex flex-col items-center gap-0.5">
              {hasCommentsDelta && (
                <span className="text-[12px] font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  +{formatEngagement(story.comments_delta!)}
                </span>
              )}
              <span className="inline-flex items-center justify-center gap-1.5 min-w-[4rem] text-[12px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full">
                <MessageSquare className="h-3 w-3" />
                {formatEngagement(story.comments)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </a>
  );
}
