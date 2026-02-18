import { MessageSquare } from "lucide-react";
import type { HNStory } from "@/lib/types";
import { extractDomain } from "@/lib/utils";

interface HNItemProps {
  story: HNStory;
}

export function HNItem({ story }: HNItemProps) {
  const domain = extractDomain(story.url);

  return (
    <a
      href={story.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-start gap-4 rounded-lg border border-border bg-card hover:border-foreground/15 transition-colors p-4"
    >
      <div className="flex flex-col items-center min-w-[40px] mt-0.5">
        <span className="text-[17px] font-bold tabular-nums text-foreground/80">
          {story.score}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 mb-1">
          <span className="text-[15px] font-semibold leading-snug flex-1">
            {story.title}
          </span>
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
        <div className="mt-2.5">
          <span
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              window.open(story.hn_url, "_blank", "noopener,noreferrer");
            }}
            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-orange-600 dark:text-orange-400 bg-orange-500/10 hover:bg-orange-500/20 px-2.5 py-1 rounded-full transition-colors cursor-pointer"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            {story.comments} discussion
          </span>
        </div>
      </div>
    </a>
  );
}
