import { db } from "@/lib/db";

/**
 * Find-or-create the unified User row for an email address. Every sync
 * module (Typeform, Amplitude, Wix) calls this so the same person always
 * lands on the same User record regardless of which source we saw them in
 * first. Email is the join key across all three systems.
 */
export async function upsertUserByEmail(
  email: string,
  extra: { name?: string | null } = {}
) {
  const normalized = email.trim().toLowerCase();
  return db.user.upsert({
    where: { email: normalized },
    update: extra.name ? { name: extra.name } : {},
    create: { email: normalized, name: extra.name ?? undefined },
  });
}
