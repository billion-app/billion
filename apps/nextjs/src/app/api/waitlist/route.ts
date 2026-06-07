import { NextResponse } from "next/server";

import { db } from "@acme/db/client";
import { CreateWaitlistSchema, Waitlist } from "@acme/db/schema";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = CreateWaitlistSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid email" },
      { status: 400 },
    );
  }

  const email = parsed.data.email.trim().toLowerCase();

  try {
    await db
      .insert(Waitlist)
      .values({ email })
      .onConflictDoNothing({ target: Waitlist.email });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("waitlist insert failed", err);
    return NextResponse.json(
      { error: "Could not join waitlist" },
      { status: 500 },
    );
  }
}
