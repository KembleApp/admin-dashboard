import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { CustomFieldType } from "@prisma/client";

const VALID_TYPES = new Set<string>(Object.values(CustomFieldType));

// Field definitions are global - created once, then reusable on any
// person's page (see AddCustomField.tsx), rather than redefined per user.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const fields = await db.customFieldDefinition.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json({ fields });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const name = (body.name as string | undefined)?.trim();
  const type = body.type as string | undefined;
  const labelOptions = Array.isArray(body.labelOptions)
    ? (body.labelOptions as unknown[]).map((o) => String(o).trim()).filter(Boolean)
    : [];

  if (!name) {
    return NextResponse.json({ error: "Field name is required" }, { status: 400 });
  }
  if (!type || !VALID_TYPES.has(type)) {
    return NextResponse.json({ error: "Invalid field type" }, { status: 400 });
  }
  if (type === "LABEL" && labelOptions.length === 0) {
    return NextResponse.json({ error: "A label field needs at least one option" }, { status: 400 });
  }

  try {
    const field = await db.customFieldDefinition.create({
      data: { name, type: type as CustomFieldType, labelOptions },
    });
    return NextResponse.json({ field });
  } catch (err) {
    return NextResponse.json({ error: "A field with that name already exists" }, { status: 409 });
  }
}
