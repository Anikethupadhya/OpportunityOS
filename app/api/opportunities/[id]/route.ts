import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = createServiceClient();

  const { data, error } = await db
    .from("opportunities")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = createServiceClient();
  const body = await request.json();

  const allowed = [
    "title", "summary", "category", "tags", "status", "rejection_reason",
    "revenue_target", "execution_confidence",
    "viability_score", "revenue_potential", "effort_estimate",
    "competition_level", "time_sensitivity", "scoring_rationale",
    "execution_readiness_score", "skill_alignment", "resource_availability",
    "time_to_first_action_hours", "ers_rationale", "execution_brief",
  ];

  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  const { data, error } = await db
    .from("opportunities")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = createServiceClient();

  const { error } = await db.from("opportunities").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
