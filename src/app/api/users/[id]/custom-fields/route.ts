import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// Sets (creates or updates) one person's value for a custom field.
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const fieldId = body.fieldId as string | undefined;
  if (!fieldId) {
    return NextResponse.json({ error: "fieldId is required" }, { status: 400 });
  }

  const field = await db.customFieldDefinition.findUnique({ where: { id: fieldId } });
  if (!field) {
    return NextResponse.json({ error: "Unknown field" }, { status: 404 });
  }

  let data: { value: string | null; labelValues: string[] };
  if (field.type === "LABEL") {
    const labelValues = Array.isArray(body.labelValues)
      ? (body.labelValues as unknown[])
          .map((v) => String(v))
          .filter((v) => field.labelOptions.includes(v))
      : [];
    data = { value: null, labelValues };
  } else {
    const value = typeof body.value === "string" ? body.value.trim() : "";
    data = { value: value || null, labelValues: [] };
  }

  const saved = await db.customFieldValue.upsert({
    where: { userId_fieldId: { userId: params.id, fieldId } },
    update: data,
    create: { userId: params.id, fieldId, ...data },
    include: { field: true },
  });

  return NextResponse.json({ value: saved });
}

// Clears a person's value for a field (the field definition itself stays,
// so it's still selectable to re-add later).
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const fieldId = searchParams.get("fieldId");
  if (!fieldId) {
    return NextResponse.json({ error: "fieldId is required" }, { status: 400 });
  }

  await db.customFieldValue.deleteMany({ where: { userId: params.id, fieldId } });
  return NextResponse.json({ ok: true });
}
