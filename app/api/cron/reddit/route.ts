import { NextRequest, NextResponse } from "next/server";
import { scanReddit, sumRecentAiCost } from "@/lib/reddit";
import { scanHackerNews } from "@/lib/hackernews";
import { runClusteringPass } from "@/lib/clustering";

// Runs every active signal source, clusters the combined output, and returns a
// merged summary. The route path stays /api/cron/reddit for compatibility, but it
// now scans Reddit + Hacker News.
async function runScan() {
  const [reddit, hackernews] = await Promise.all([scanReddit(), scanHackerNews()]);

  // scanReddit() clusters its own signals at the end. Run one more pass to pick up
  // Hacker News signals (inserted in parallel) and anything left unclustered.
  let extraNewClusters = 0;
  try {
    const pass = await runClusteringPass();
    extraNewClusters = pass.new_clusters;
  } catch (err) {
    console.error("[scan] post-merge clustering pass failed:", err);
  }

  const ran_at = new Date().toISOString();
  const sources = ["reddit", "hackernews"];
  const posts_fetched =
    reddit.rawFetchedNew +
    reddit.rawFetchedTop +
    hackernews.rawFetchedNew +
    hackernews.rawFetchedTop;
  const tier2_passes = reddit.discovered + hackernews.discovered;
  const new_clusters = reddit.clustering_new_clusters + extraNewClusters;
  const ai_cost_usd = await sumRecentAiCost();

  return {
    ran_at,
    sources,
    posts_fetched,
    tier2_passes,
    new_clusters,
    ai_cost_usd,
    reddit,
    hackernews,
  };
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runScan();
  return NextResponse.json(result);
}

export async function POST() {
  const result = await runScan();
  return NextResponse.json(result);
}
