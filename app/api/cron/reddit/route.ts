import { NextRequest, NextResponse } from "next/server";
import { scanReddit } from "@/lib/reddit";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await scanReddit();
  return NextResponse.json(result);
}

export async function POST() {
  const result = await scanReddit();
  return NextResponse.json(result);
}
