import { BarChart3 } from "lucide-react";

interface WeeklyPageProps {
  params: Promise<{ week: string }>;
}

export default async function WeeklyPage({ params }: WeeklyPageProps) {
  await params; // consume the promise (required by Next.js)

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-12 h-12 rounded-full bg-foreground/[0.04] flex items-center justify-center mb-4">
        <BarChart3 className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-[15px] font-medium mb-1">Weekly Insights</p>
      <p className="text-[13px] text-muted-foreground max-w-sm">
        This feature will summarize the top themes and trends from the week.
        It will become available once there is enough daily digest data to
        generate meaningful weekly insights.
      </p>
    </div>
  );
}
