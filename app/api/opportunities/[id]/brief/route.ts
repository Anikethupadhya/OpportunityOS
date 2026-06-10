import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/db";
import { generateBrief } from "@/lib/prompts/brief";

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

  const brief = await generateBrief(opp);

  const { data, error } = await db
    .from("opportunities")
    .update({ execution_brief: brief, status: "approved" })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
