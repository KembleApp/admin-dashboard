import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { EditableModel, fieldKind, parseFieldValue } from "@/lib/editableFields";

// Saves a manual edit to one field on a user's page (Demographics,
// Amplitude, or Wix section) and records it in that record's `overrides`
// JSON, so future syncs skip re-writing this field - see applyOverrides.
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const model = body.model as EditableModel;
  const field = body.field as string;
  const rawValue = body.value as string;

  const kind = fieldKind(model, field);
  if (!kind) {
    return NextResponse.json({ error: "Field is not editable" }, { status: 400 });
  }

  const value = parseFieldValue(kind, rawValue);

  if (model === "user") {
    const existing = await db.user.findUnique({ where: { id: params.id }, select: { overrides: true } });
    const overrides = { ...((existing?.overrides as Record<string, unknown>) ?? {}), [field]: value };
    const updated = await db.user.update({
      where: { id: params.id },
      data: { [field]: value, overrides } as any,
    });
    return NextResponse.json({ value: (updated as any)[field] });
  }

  if (model === "amplitudeProfile") {
    const existing = await db.amplitudeProfile.findUnique({
      where: { userId: params.id },
      select: { overrides: true },
    });
    if (!existing) return NextResponse.json({ error: "No Amplitude profile for this user" }, { status: 404 });
    const overrides = { ...((existing.overrides as Record<string, unknown>) ?? {}), [field]: value };
    const updated = await db.amplitudeProfile.update({
      where: { userId: params.id },
      data: { [field]: value, overrides } as any,
    });
    return NextResponse.json({ value: (updated as any)[field] });
  }

  if (model === "wixContact") {
    const existing = await db.wixContact.findUnique({
      where: { userId: params.id },
      select: { overrides: true },
    });
    if (!existing) return NextResponse.json({ error: "No Wix contact for this user" }, { status: 404 });
    const overrides = { ...((existing.overrides as Record<string, unknown>) ?? {}), [field]: value };
    const updated = await db.wixContact.update({
      where: { userId: params.id },
      data: { [field]: value, overrides } as any,
    });
    return NextResponse.json({ value: (updated as any)[field] });
  }

  return NextResponse.json({ error: "Unknown model" }, { status: 400 });
}
