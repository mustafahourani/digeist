import { NextRequest, NextResponse } from "next/server";
import { runWeeklyPipeline } from "@/lib/weekly-pipeline";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const digest = await runWeeklyPipeline();

    return NextResponse.json({
      success: true,
      week: digest.week,
      themes: digest.top_themes.length,
      start_date: digest.start_date,
      end_date: digest.end_date,
    });
  } catch (error) {
    console.error("Weekly cron error:", error);
    return NextResponse.json(
      {
        error: "Weekly pipeline failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
