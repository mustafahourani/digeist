import { Star, GitFork, TrendingUp, Clock } from "lucide-react";
import { formatEngagement } from "@/lib/utils";
import type { GitHubRepo } from "@/lib/types";

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function repoAge(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days < 1) return "today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return rem > 0 ? `${years}y ${rem}mo ago` : `${years}y ago`;
}

interface GitHubItemProps {
  repo: GitHubRepo;
}

export function GitHubItem({ repo }: GitHubItemProps) {
  const owner = repo.name.split("/")[0];
  const repoName = repo.name.split("/")[1] || repo.name;
  const hasStarsDelta = repo.stars_delta != null && repo.stars_delta > 0;
  const hasForksDelta = repo.forks_delta != null && repo.forks_delta > 0;

  return (
    <a
      href={repo.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex flex-col h-[160px] rounded-lg border border-border bg-card hover:border-foreground/15 transition-colors"
    >
      <div className="flex flex-col flex-1 p-4 min-h-0">
        {/* Header: name */}
        <div className="flex items-center gap-2 mb-1.5">
          <div className="min-w-0">
            <span className="text-[13px] text-muted-foreground">{owner}/</span>
            <span className="text-[15px] font-semibold">{repoName}</span>
          </div>
        </div>

        {/* Description — fixed 2-line clamp */}
        <p className="text-[13px] text-muted-foreground leading-[1.5] mb-auto line-clamp-2">
          {repo.description}
        </p>

        {/* Bottom row: date left, stats right */}
        <div className="flex items-end justify-between pt-2">
          {/* Left: creation date */}
          <div className="flex items-center gap-1 text-[12px] text-muted-foreground">
            {repo.created_at && (
              <>
                <Clock className="h-3 w-3" />
                {repoAge(repo.created_at)}
              </>
            )}
          </div>

          {/* Right: each stat as a column — delta directly above its pill */}
          <div className="flex items-end gap-2">
            {/* Stars column */}
            <div className="flex flex-col items-center gap-0.5">
              {hasStarsDelta && (
                <span className="text-[12px] font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  +{formatEngagement(repo.stars_delta!)}
                </span>
              )}
              <span className="inline-flex items-center justify-center gap-1 min-w-[4rem] text-[12px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full">
                <Star className="h-3 w-3" fill="currentColor" />
                {formatEngagement(repo.stars)}
              </span>
            </div>
            {/* Forks column */}
            <div className="flex flex-col items-center gap-0.5">
              {hasForksDelta && (
                <span className="text-[12px] font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  +{formatEngagement(repo.forks_delta!)}
                </span>
              )}
              <span className="inline-flex items-center justify-center gap-1 min-w-[4rem] text-[12px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full">
                <GitFork className="h-3 w-3" />
                {formatEngagement(repo.forks ?? 0)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </a>
  );
}
