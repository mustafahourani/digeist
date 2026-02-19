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
      github_repos: digest.sections.github.new_repos.length + digest.sections.github.trending_repos.length,
      hn_stories: digest.sections.hackernews.hot_stories.length + digest.sections.hackernews.rising_stories.length,
      reddit_posts: digest.sections.reddit.hot_posts.length + digest.sections.reddit.rising_posts.length,
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
