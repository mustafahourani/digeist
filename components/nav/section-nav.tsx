"use client";

import { cn } from "@/lib/utils";

export type SectionId = "ai-twitter" | "crypto-twitter" | "github" | "hackernews";

export const sectionTabs: { id: SectionId; label: string }[] = [
  { id: "ai-twitter", label: "X / AI" },
  { id: "crypto-twitter", label: "X / Crypto" },
  { id: "github", label: "GitHub" },
  { id: "hackernews", label: "Hacker News" },
];

interface SectionNavProps {
  activeTab: SectionId;
  onTabChange: (tab: SectionId) => void;
}

export function SectionNav({ activeTab, onTabChange }: SectionNavProps) {
  return (
    <div className="sticky top-14 z-40 bg-background/95 backdrop-blur-md border-b border-border -mx-6 px-6">
      <div className="flex items-center gap-1 py-2.5 overflow-x-auto scrollbar-none">
        {sectionTabs.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className={cn(
              "px-3.5 py-2 rounded-lg text-[14px] font-medium whitespace-nowrap transition-colors",
              activeTab === id
                ? "bg-foreground/[0.08] text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.03]"
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
