import { cn } from "@/lib/utils";

interface SentimentBarProps {
  percentage: number;
  compact?: boolean;
}

function sentimentLabel(pct: number): string {
  if (pct >= 60) return "Positive";
  if (pct >= 40) return "Neutral";
  return "Negative";
}

export function SentimentBar({ percentage, compact = false }: SentimentBarProps) {
  const color =
    percentage >= 60
      ? "bg-emerald-500/80 dark:bg-emerald-400/80"
      : percentage >= 40
        ? "bg-amber-500/80 dark:bg-amber-400/80"
        : "bg-rose-500/70 dark:bg-rose-400/70";

  const trackColor =
    percentage >= 60
      ? "bg-emerald-500/10 dark:bg-emerald-400/10"
      : percentage >= 40
        ? "bg-amber-500/10 dark:bg-amber-400/10"
        : "bg-rose-500/10 dark:bg-rose-400/10";

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className={cn("w-12 h-1.5 rounded-full overflow-hidden", trackColor)}>
          <div
            className={cn("h-full rounded-full", color)}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">{percentage}%</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5">
      <span className="text-[13px] text-muted-foreground">
        {sentimentLabel(percentage)}
      </span>
      <div className={cn("w-24 h-2 rounded-full overflow-hidden", trackColor)}>
        <div
          className={cn("h-full rounded-full transition-all duration-500", color)}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
