import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// Admin-pasted CSV of "amplitude_user_id,email" pairs, used by the
// Amplitude sync as a manual fallback when events don't carry an email
// user property. See AmplitudeEmailMap in schema.prisma.
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.text();
  const rows: { amplitudeUserId: string; email: string }[] = [];

  for (const line of body.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const [rawId, rawEmail] = trimmed.split(",").map((s) => s.trim());
    if (!rawId || !rawEmail) continue;
    if (!rawEmail.includes("@")) continue; // skip a header row like "user_id,email"

    rows.push({ amplitudeUserId: rawId, email: rawEmail.toLowerCase() });
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: "No valid rows found" }, { status: 400 });
  }

  for (const row of rows) {
    await db.amplitudeEmailMap.upsert({
      where: { amplitudeUserId: row.amplitudeUserId },
      update: { email: row.email },
      create: row,
    });
  }

  return NextResponse.json({ imported: rows.length });
}
