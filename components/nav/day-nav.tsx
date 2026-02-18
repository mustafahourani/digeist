"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, formatDate } from "@/lib/utils";

interface DayNavProps {
  currentDate: string;
  hasNext?: boolean;
}

export function DayNav({ currentDate, hasNext = true }: DayNavProps) {
  const prevDate = addDays(currentDate, -1);
  const nextDate = addDays(currentDate, 1);

  return (
    <div className="pt-8 pb-5">
      <div className="flex items-center justify-between">
        <Link
          href={`/digest/${prevDate}`}
          className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors py-1.5 px-2.5 -ml-2 rounded-md hover:bg-foreground/[0.03]"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Previous
        </Link>
        <div className="text-center">
          <h1 className="font-serif text-3xl">{formatDate(currentDate)}</h1>
        </div>
        {hasNext ? (
          <Link
            href={`/digest/${nextDate}`}
            className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors py-1.5 px-2.5 -mr-2 rounded-md hover:bg-foreground/[0.03]"
          >
            Next
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        ) : (
          <div className="w-[80px]" />
        )}
      </div>
      <div className="mt-4 space-y-[2px]">
        <div className="h-px bg-foreground/20" />
        <div className="h-px bg-foreground/10" />
      </div>
    </div>
  );
}
