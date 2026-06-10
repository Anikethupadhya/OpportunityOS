import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = createServiceClient();

  const { data, error } = await db
    .from("revenue_events")
    .select("*")
    .eq("opportunity_id", id)
    .order("recorded_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = createServiceClient();
  const body = await request.json();

  const { data, error } = await db
    .from("revenue_events")
    .insert({
      opportunity_id: id,
      amount: Number(body.amount),
      currency: body.currency ?? "USD",
      platform: body.platform,
      platform_link: body.platform_link ?? null,
      notes: body.notes ?? null,
      recorded_at: body.recorded_at ?? new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
