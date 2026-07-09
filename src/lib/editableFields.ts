// Single source of truth for which fields an admin can manually edit on the
// user detail page, shared by the edit API route and the UI. Deliberately
// limited to simple string/number columns - JSON/array fields (Wix labels,
// custom fields, addresses; Amplitude's raw event history; Typeform
// answers) need a different edit UI and aren't covered here. User.email is
// excluded too: it's the join key syncs match people on, so editing it
// could orphan a person's synced data on the next sync.
export type EditableModel = "user" | "amplitudeProfile" | "wixContact";
export type FieldKind = "string" | "number";

type FieldDef = { field: string; label: string; kind: FieldKind };

export const EDITABLE_FIELDS: Record<EditableModel, FieldDef[]> = {
  user: [
    { field: "name", label: "Name", kind: "string" },
    { field: "phone", label: "Phone", kind: "string" },
    { field: "location", label: "Location", kind: "string" },
    { field: "company", label: "Company", kind: "string" },
    { field: "jobTitle", label: "Job title", kind: "string" },
  ],
  amplitudeProfile: [
    { field: "platform", label: "Platform", kind: "string" },
    { field: "deviceType", label: "Device type", kind: "string" },
    { field: "totalEvents", label: "Total events", kind: "number" },
    { field: "sessionCount", label: "Sessions (session_started)", kind: "number" },
    { field: "goalCompletedCount", label: "Goals completed (goal_creation_completed)", kind: "number" },
    { field: "goalSharedCount", label: "Goals shared (goal_card_shared)", kind: "number" },
    { field: "partnerInvitedCount", label: "Partner invited (partner_invited)", kind: "number" },
    { field: "partnerUuid", label: "Partner UUID (accepted_by)", kind: "string" },
  ],
  wixContact: [
    { field: "source", label: "Source", kind: "string" },
    { field: "lastActivityType", label: "Last activity type", kind: "string" },
    { field: "birthdate", label: "Birthdate", kind: "string" },
    { field: "locale", label: "Locale", kind: "string" },
    { field: "subscriptionStatus", label: "Email subscription", kind: "string" },
  ],
};

export function fieldKind(model: EditableModel, field: string): FieldKind | undefined {
  return EDITABLE_FIELDS[model].find((f) => f.field === field)?.kind;
}

export function parseFieldValue(kind: FieldKind, raw: string): string | number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  if (kind === "number") {
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  }
  return trimmed;
}

// Merges saved overrides on top of freshly-synced field values - overrides
// win, so a manual edit survives the next sync instead of being reverted.
export function applyOverrides<T extends Record<string, unknown>>(fresh: T, overrides: unknown): T {
  if (!overrides || typeof overrides !== "object") return fresh;
  const result = { ...fresh };
  for (const [key, value] of Object.entries(overrides as Record<string, unknown>)) {
    if (key in result) (result as Record<string, unknown>)[key] = value;
  }
  return result;
}
