import { NextRequest, NextResponse } from "next/server";
import { runDailyPipeline } from "@/lib/pipeline";

export const maxDuration = 60; // seconds (Vercel free tier max)

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const digest = await runDailyPipeline();

    return NextResponse.json({
      success: true,
      date: digest.date,
      sources: digest.sources_status,
      clusters: {
        ai_twitter: digest.sections.ai_twitter.clusters.length,
        crypto_ai_twitter: digest.sections.crypto_ai_twitter.clusters.length,
      },
      github_repos: digest.sections.github.repos.length,
      hn_stories: digest.sections.hackernews.stories.length,
    });
  } catch (error) {
    console.error("Cron generate error:", error);
    return NextResponse.json(
      {
        error: "Pipeline failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
