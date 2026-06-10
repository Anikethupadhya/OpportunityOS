import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/db";

const VALID_OFFER_STATUSES = ["draft", "approved"] as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body: { offer_status?: string; offer_notes?: string };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { offer_status, offer_notes } = body;

  if (!offer_status || !(VALID_OFFER_STATUSES as readonly string[]).includes(offer_status)) {
    return NextResponse.json(
      { error: `offer_status must be one of: ${VALID_OFFER_STATUSES.join(" | ")}` },
      { status: 400 }
    );
  }

  if (typeof offer_notes !== "string" || offer_notes.trim() === "") {
    return NextResponse.json(
      { error: "offer_notes is required" },
      { status: 400 }
    );
  }

  const db = createServiceClient();

  const { data, error } = await db
    .from("problem_clusters")
    .update({ offer_status, offer_notes })
    .eq("id", id)
    .select("offer_status, offer_notes")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, ...data });
}
