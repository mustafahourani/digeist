import { MessageSquare, ExternalLink } from "lucide-react";
import type { HNStory } from "@/lib/types";
import { extractDomain } from "@/lib/utils";

interface HNItemProps {
  story: HNStory;
}

export function HNItem({ story }: HNItemProps) {
  const domain = extractDomain(story.url);

  return (
    <div className="flex items-start gap-4 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-col items-center min-w-[40px] mt-0.5">
        <span className="text-[17px] font-bold tabular-nums text-foreground/80">
          {story.score}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 mb-1">
          <a
            href={story.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[15px] font-semibold leading-snug hover:underline decoration-foreground/30 underline-offset-2 flex-1"
          >
            {story.title}
          </a>
        </div>
        {domain && (
          <span className="text-[13px] text-muted-foreground mono">
            {domain}
          </span>
        )}
        {story.summary && (
          <p className="text-[14px] text-muted-foreground leading-relaxed mt-1.5">
            {story.summary}
          </p>
        )}
        <div className="flex items-center gap-4 mt-2.5">
          <a
            href={story.hn_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <MessageSquare className="h-4 w-4" />
            {story.comments} comments
          </a>
          <a
            href={story.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            visit
          </a>
        </div>
      </div>
    </div>
  );
}
