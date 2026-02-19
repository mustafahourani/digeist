import { ThumbsUp, MessageSquare, Clock } from "lucide-react";
import type { RedditPost } from "@/lib/types";
import { extractDomain, formatEngagement, timeAgo } from "@/lib/utils";

interface RedditItemProps {
  post: RedditPost;
}

export function RedditItem({ post }: RedditItemProps) {
  const domain = post.is_self ? null : extractDomain(post.url);
  const hasScoreDelta = post.score_delta != null && post.score_delta > 0;
  const hasCommentsDelta = post.comments_delta != null && post.comments_delta > 0;

  return (
    <a
      href={post.reddit_url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex flex-col h-[132px] rounded-lg border border-border bg-card hover:border-foreground/15 transition-colors"
    >
      <div className="flex flex-col flex-1 p-4 min-h-0">
        {/* Subreddit badge */}
        <span className="text-[11px] font-medium text-muted-foreground mb-0.5">
          r/{post.subreddit}{domain ? ` · ${domain}` : ""}
        </span>

        {/* Title — clamped to 2 lines */}
        <span className="text-[15px] font-semibold leading-snug line-clamp-2 mb-auto">
          {post.title}
        </span>

        {/* Bottom row: date left, stats right */}
        <div className="flex items-end justify-between pt-2">
          {/* Left: creation date */}
          <div className="flex items-center gap-1 text-[12px] text-muted-foreground">
            {post.created_at && (
              <>
                <Clock className="h-3 w-3" />
                {timeAgo(post.created_at)}
              </>
            )}
          </div>

          {/* Right: upvotes + comments columns */}
          <div className="flex items-end gap-2">
            {/* Upvotes column */}
            <div className="flex flex-col items-center gap-0.5">
              {hasScoreDelta && (
                <span className="text-[12px] font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  +{formatEngagement(post.score_delta!)}
                </span>
              )}
              <span className="inline-flex items-center justify-center gap-1 min-w-[4rem] text-[12px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full">
                <ThumbsUp className="h-3 w-3" />
                {formatEngagement(post.score)}
              </span>
            </div>
            {/* Comments column */}
            <div className="flex flex-col items-center gap-0.5">
              {hasCommentsDelta && (
                <span className="text-[12px] font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  +{formatEngagement(post.comments_delta!)}
                </span>
              )}
              <span className="inline-flex items-center justify-center gap-1.5 min-w-[4rem] text-[12px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full">
                <MessageSquare className="h-3 w-3" />
                {formatEngagement(post.comments)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </a>
  );
}
