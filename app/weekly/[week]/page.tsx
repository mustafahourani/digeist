import { getWeeklyDigest, listWeeklyDigests } from "@/lib/storage";
import { redirect } from "next/navigation";
import { WeekNav } from "@/components/nav/week-nav";
import { SentimentBar } from "@/components/digest/sentiment-bar";
import { formatEngagement } from "@/lib/utils";
import { Calendar, TrendingUp, BarChart3 } from "lucide-react";

interface WeeklyPageProps {
  params: Promise<{ week: string }>;
}

export default async function WeeklyPage({ params }: WeeklyPageProps) {
  const { week } = await params;
  const allWeeks = await listWeeklyDigests();

  // Handle "latest" redirect
  if (week === "latest") {
    if (allWeeks.length > 0) {
      redirect(`/weekly/${allWeeks[0]}`);
    }
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-12 h-12 rounded-full bg-foreground/[0.04] flex items-center justify-center mb-4">
          <BarChart3 className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-[15px] font-medium mb-1">No weekly digests yet</p>
        <p className="text-[13px] text-muted-foreground">
          The first weekly rollup will be generated on Sunday at 12:00 PM EST
        </p>
      </div>
    );
  }

  const digest = await getWeeklyDigest(week);

  if (!digest) {
    return (
      <div>
        <WeekNav currentWeek={week} allWeeks={allWeeks} />
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-12 h-12 rounded-full bg-foreground/[0.04] flex items-center justify-center mb-4">
            <Calendar className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-[15px] font-medium mb-1">No weekly digest</p>
          <p className="text-[13px] text-muted-foreground">
            There&apos;s no weekly rollup for {week}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <WeekNav currentWeek={week} allWeeks={allWeeks} />

      {/* Date range subtitle */}
      <p className="text-[13px] text-muted-foreground text-center -mt-4 mb-8">
        {digest.start_date} &mdash; {digest.end_date}
      </p>

      {/* Week over Week */}
      {digest.week_over_week && (
        <div className="rounded-xl border border-border bg-card p-5 mb-10">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Week over Week
            </h2>
          </div>
          <p className="text-[13.5px] leading-[1.65] text-card-foreground">
            {digest.week_over_week}
          </p>
        </div>
      )}

      {/* Top Themes */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[17px] font-semibold tracking-tight">Top Themes</h2>
          <span className="text-[12px] text-muted-foreground">{digest.top_themes.length} themes</span>
        </div>
        <div className="h-px bg-border mb-5" />
        <div className="space-y-4">
          {digest.top_themes.map((theme, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <h3 className="text-[15px] font-semibold leading-snug">{theme.name}</h3>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    {theme.days_appeared}d active
                  </span>
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    {formatEngagement(theme.total_engagement)} engagement
                  </span>
                </div>
              </div>
              <div className="mb-3">
                <SentimentBar percentage={theme.sentiment_avg} />
              </div>
              <p className="text-[13.5px] text-muted-foreground leading-[1.6]">
                {theme.summary}
              </p>
              {theme.representative_tweets && theme.representative_tweets.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-widest font-semibold mb-2">
                    Key tweets
                  </p>
                  <div className="space-y-1.5">
                    {theme.representative_tweets.map((text, j) => (
                      <p key={j} className="text-[12px] text-muted-foreground leading-relaxed pl-3 border-l-2 border-border">
                        {text}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Source Highlights */}
      <div>
        <h2 className="text-[17px] font-semibold tracking-tight mb-4">Source Highlights</h2>
        <div className="h-px bg-border mb-5" />
        <div className="grid grid-cols-2 gap-4">
          {Object.entries(digest.source_highlights).map(([source, items]) => {
            const labels: Record<string, string> = {
              ai_twitter: "X / AI",
              crypto_ai_twitter: "X / Crypto",
              github: "GitHub",
              hackernews: "Hacker News",
            };
            const label = labels[source] || source;
            return (
              <div key={source} className="rounded-xl border border-border bg-card p-4">
                <h3 className="text-[13px] font-semibold mb-3">{label}</h3>
                <ul className="space-y-1.5">
                  {items.map((item, i) => (
                    <li key={i} className="text-[12px] text-muted-foreground leading-snug flex gap-2">
                      <span className="text-foreground/30 shrink-0">&bull;</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
