import { db } from "@/lib/db";

/**
 * Find-or-create the unified User row for an email address. Every sync
 * module (Typeform, Amplitude, Wix) calls this so the same person always
 * lands on the same User record regardless of which source we saw them in
 * first. Email is the join key across all three systems.
 *
 * If an admin has manually edited `name` on this user's page, that
 * override wins over whatever the sync source has - see
 * lib/editableFields.ts.
 */
export async function upsertUserByEmail(
  email: string,
  extra: { name?: string | null } = {}
) {
  const normalized = email.trim().toLowerCase();
  const existing = await db.user.findUnique({
    where: { email: normalized },
    select: { overrides: true },
  });
  const overrides = (existing?.overrides as Record<string, unknown> | null) ?? {};
  const name = "name" in overrides ? (overrides.name as string | null) : extra.name;

  return db.user.upsert({
    where: { email: normalized },
    update: name ? { name } : {},
    create: { email: normalized, name: name ?? undefined },
  });
}
