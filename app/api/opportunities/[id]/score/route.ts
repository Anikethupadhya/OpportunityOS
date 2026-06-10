import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/db";
import { scoreOpportunity } from "@/lib/prompts/scoring";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = createServiceClient();

  const { data: opp, error: fetchError } = await db
    .from("opportunities")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !opp) {
    return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
  }

  const scores = await scoreOpportunity({
    title: opp.title,
    summary: opp.summary,
    source_type: opp.source_type,
    source_raw: opp.source_raw,
    category: opp.category,
    opportunityId: id,
  });

  const { data, error } = await db
    .from("opportunities")
    .update({
      ...scores,
      status: opp.status === "discovered" ? "reviewed" : opp.status,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
