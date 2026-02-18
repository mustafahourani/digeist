"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface WeekNavProps {
  currentWeek: string;
  allWeeks: string[];
}

export function WeekNav({ currentWeek, allWeeks }: WeekNavProps) {
  const currentIndex = allWeeks.indexOf(currentWeek);
  const prevWeek = currentIndex < allWeeks.length - 1 ? allWeeks[currentIndex + 1] : null;
  const nextWeek = currentIndex > 0 ? allWeeks[currentIndex - 1] : null;

  // Parse week string like "2026-W07" into readable form
  const weekLabel = currentWeek.replace("-", " ");

  return (
    <div className="flex items-center justify-between pt-8 pb-6">
      {prevWeek ? (
        <Link
          href={`/weekly/${prevWeek}`}
          className="flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground transition-colors py-1.5 px-2 -ml-2 rounded-md hover:bg-foreground/[0.03]"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Previous
        </Link>
      ) : (
        <div className="w-[80px]" />
      )}
      <div className="text-center">
        <h1 className="text-[22px] font-semibold tracking-tight">{weekLabel}</h1>
      </div>
      {nextWeek ? (
        <Link
          href={`/weekly/${nextWeek}`}
          className="flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground transition-colors py-1.5 px-2 -mr-2 rounded-md hover:bg-foreground/[0.03]"
        >
          Next
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      ) : (
        <div className="w-[80px]" />
      )}
    </div>
  );
}
