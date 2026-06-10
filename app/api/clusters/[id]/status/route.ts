import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/db";

const VALID_STATUSES = ["would_build", "would_not_build", "maybe"] as const;
type HumanStatus = (typeof VALID_STATUSES)[number];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body: { human_status?: string; rejection_reason?: string };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { human_status, rejection_reason } = body;

  if (!human_status || !(VALID_STATUSES as readonly string[]).includes(human_status)) {
    return NextResponse.json(
      { error: `human_status must be one of: ${VALID_STATUSES.join(" | ")}` },
      { status: 400 }
    );
  }

  if (human_status === "would_not_build" && !rejection_reason) {
    return NextResponse.json(
      { error: "rejection_reason is required for would_not_build" },
      { status: 400 }
    );
  }

  const db = createServiceClient();

  const { data, error } = await db
    .from("problem_clusters")
    .update({
      human_status: human_status as HumanStatus,
      rejection_reason: rejection_reason ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("human_status, rejection_reason")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, ...data });
}
