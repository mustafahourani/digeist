import { Star } from "lucide-react";
import { formatEngagement } from "@/lib/utils";
import type { GitHubRepo } from "@/lib/types";

interface GitHubItemProps {
  repo: GitHubRepo;
}

export function GitHubItem({ repo }: GitHubItemProps) {
  return (
    <a
      href={repo.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex flex-col rounded-lg border border-border bg-card hover:border-foreground/15 transition-colors"
    >
      <div className="flex-1 p-4">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <span className="text-[15px] font-semibold mono truncate">
            {repo.name}
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            <Star className="h-4 w-4 text-amber-500 dark:text-amber-400" fill="currentColor" />
            <span className="text-[13px] tabular-nums font-medium">
              {formatEngagement(repo.stars)}
            </span>
            {repo.stars_delta != null && repo.stars_delta > 0 && (
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium tabular-nums">
                +{formatEngagement(repo.stars_delta)}
              </span>
            )}
          </div>
        </div>
        <p className="text-[14px] text-muted-foreground leading-relaxed">
          {repo.description}
        </p>
      </div>
    </a>
  );
}
