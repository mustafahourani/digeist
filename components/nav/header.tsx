"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./theme-toggle";

export function Header() {
  const pathname = usePathname();
  const isWeekly = pathname.startsWith("/weekly");
  const isArchive = pathname === "/archive";
  return (
    <header className="border-b border-border bg-background/95 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <span className="font-serif text-[22px] text-foreground">
            Digeist
          </span>
        </Link>
        <div className="flex items-center gap-1">
          <nav className="flex items-center gap-0.5">
            {[
              { href: "/", label: "Daily", active: !isWeekly && !isArchive },
              { href: "/weekly/latest", label: "Weekly", active: isWeekly },
              { href: "/archive", label: "Archive", active: isArchive },
            ].map(({ href, label, active }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "px-3.5 py-1.5 rounded-md text-[14px] transition-colors",
                  active
                    ? "bg-foreground/[0.06] text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.03]"
                )}
              >
                {label}
              </Link>
            ))}
          </nav>
          <div className="w-px h-5 bg-border mx-1" />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
