import { Heart, Repeat2, Eye } from "lucide-react";
import { formatEngagement, relativeTime } from "@/lib/utils";
import type { Tweet } from "@/lib/types";

interface TweetEmbedProps {
  tweet: Tweet;
}

export function TweetEmbed({ tweet }: TweetEmbedProps) {
  return (
    <a
      href={tweet.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-lg border border-border/60 bg-background p-4 hover:border-foreground/15 transition-colors"
    >
      <div className="flex items-center gap-2.5 mb-2">
        {tweet.author_avatar ? (
          <img
            src={tweet.author_avatar}
            alt=""
            className="w-8 h-8 rounded-full"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-foreground/[0.06] flex items-center justify-center text-xs font-semibold text-muted-foreground">
            {tweet.author_name[0]}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <span className="text-[14px] font-semibold truncate">{tweet.author_name}</span>
          <span className="text-[13px] text-muted-foreground mono ml-1.5">{tweet.author_handle}</span>
        </div>
        <span className="text-[12px] text-muted-foreground shrink-0">
          {relativeTime(tweet.created_at)}
        </span>
      </div>
      <p className="text-[14px] leading-[1.6] mb-2.5 text-foreground/90">{tweet.text}</p>
      <div className="flex items-center gap-5 text-[12px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Heart className="h-3.5 w-3.5" />
          {formatEngagement(tweet.likes)}
        </span>
        <span className="flex items-center gap-1.5">
          <Repeat2 className="h-3.5 w-3.5" />
          {formatEngagement(tweet.retweets)}
        </span>
        <span className="flex items-center gap-1.5">
          <Eye className="h-3.5 w-3.5" />
          {formatEngagement(tweet.views)}
        </span>
      </div>
    </a>
  );
}
