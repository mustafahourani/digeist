import Link from "next/link";
import { listDigestDates, listWeeklyDigests } from "@/lib/storage";
import { formatDateShort } from "@/lib/utils";
import { ChevronRight, Calendar, BarChart3 } from "lucide-react";

export default async function ArchivePage() {
  const [dates, weeks] = await Promise.all([
    listDigestDates(),
    listWeeklyDigests(),
  ]);

  return (
    <div className="pt-8 pb-16">
      <h1 className="text-[22px] font-semibold tracking-tight mb-8">Archive</h1>

      <div className="grid grid-cols-2 gap-10">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Daily Digests
            </h2>
          </div>
          {dates.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">No digests yet.</p>
          ) : (
            <div className="space-y-1">
              {dates.map((date) => (
                <Link
                  key={date}
                  href={`/digest/${date}`}
                  className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-border bg-card hover:border-foreground/15 transition-colors group"
                >
                  <span className="text-[13px] font-medium">{formatDateShort(date)}</span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Weekly Rollups
            </h2>
          </div>
          {weeks.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">
              No weekly rollups yet.
            </p>
          ) : (
            <div className="space-y-1">
              {weeks.map((week) => (
                <Link
                  key={week}
                  href={`/weekly/${week}`}
                  className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-border bg-card hover:border-foreground/15 transition-colors group"
                >
                  <span className="text-[13px] font-medium">{week}</span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
