import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/db";

export async function GET(request: NextRequest) {
  const db = createServiceClient();
  const { searchParams } = new URL(request.url);

  const status = searchParams.get("status");
  const category = searchParams.get("category");
  const sort = searchParams.get("sort") ?? "score";

  let query = db.from("opportunities").select("*");

  if (status) query = query.eq("status", status);
  if (category) query = query.eq("category", category);

  if (sort === "score") {
    query = query.order("viability_score", { ascending: false, nullsFirst: false });
  } else if (sort === "revenue") {
    query = query.order("revenue_actual", { ascending: false });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const db = createServiceClient();
  const body = await request.json();

  const { data, error } = await db
    .from("opportunities")
    .insert({
      title: body.title,
      summary: body.summary,
      source_type: body.source_type ?? "manual",
      source_url: body.source_url ?? null,
      source_raw: body.source_raw ?? "",
      category: body.category ?? "digital_product",
      tags: body.tags ?? [],
      status: "discovered",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
