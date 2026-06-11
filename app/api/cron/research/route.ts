import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/db";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Researches every cluster that has never been researched (research_status IS NULL),
// one at a time. Each cluster goes through POST /api/clusters/[id]/research, which
// does the web-search call and owns its own pending/complete/failed status writes.
function baseUrl(): string {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

async function runResearch() {
  if (process.env.RESEARCH_AUTO_ENABLED !== 'true') {
    return { researched: 0, failed: 0, skipped: 'auto research disabled' };
  }

  const db = createServiceClient();
  const { data: clusters } = await db
    .from("problem_clusters")
    .select("id, canonical_name")
    .is("research_status", null)
    .order("created_at", { ascending: false })
    .limit(5);

  let succeeded = 0;
  let failed = 0;

  let first = true;
  for (const cluster of clusters ?? []) {
    // 35s gap between research calls — the web-search calls 429 against the org's
    // Anthropic input-token/min limit when fired back to back.
    if (!first) await delay(35_000);
    first = false;
    try {
      const res = await fetch(`${baseUrl()}/api/clusters/${cluster.id}/research`, {
        method: "POST",
      });
      if (res.ok) {
        succeeded++;
        console.log(`[research-cron] complete: ${cluster.canonical_name}`);
      } else {
        failed++;
        console.error(
          `[research-cron] failed (${res.status}): ${cluster.canonical_name}`
        );
      }
    } catch (err) {
      failed++;
      console.error(`[research-cron] error: ${cluster.canonical_name}`, err);
    }
  }

  return { researched: succeeded, failed };
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runResearch();
  return NextResponse.json(result);
}

export async function POST() {
  const result = await runResearch();
  return NextResponse.json(result);
}
