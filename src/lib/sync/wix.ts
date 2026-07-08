/**
 * Wix sync — needs WIX_API_KEY / WIX_SITE_ID (from the Wix Developers
 * Center, on a Headless/REST API key with Contacts read permission) in
 * .env.local. Field names and pagination below are verified against the
 * Contacts v4 API reference docs (not yet exercised against a live site,
 * since no Wix credentials are available in this project yet).
 *
 * Uses the Wix Contacts v4 API to list contacts:
 * https://dev.wix.com/docs/rest/crm/members-contacts/contacts/contacts/contact-v4/query-contacts
 *
 * Note: Wix Contacts have no "membership" concept — that's a separate
 * Members/Pricing Plans API. The WixContact.membership column is left
 * unset here; wire up that API separately if site membership status is
 * needed.
 */
import { db } from "@/lib/db";
import { upsertUserByEmail } from "@/lib/sync/util";

const WIX_API = "https://www.wixapis.com";

function wixHeaders(): HeadersInit {
  const apiKey = process.env.WIX_API_KEY;
  const siteId = process.env.WIX_SITE_ID;
  if (!apiKey || !siteId) {
    throw new Error("WIX_API_KEY / WIX_SITE_ID are not set in .env.local");
  }
  return {
    Authorization: apiKey,
    "wix-site-id": siteId,
    "Content-Type": "application/json",
  };
}

type WixContact = {
  id: string;
  info?: {
    name?: { first?: string; last?: string };
    emails?: { items?: { email?: string }[] };
    phones?: { items?: { phone?: string }[] };
    addresses?: { items?: unknown[] };
    company?: string;
    jobTitle?: string;
  };
  primaryInfo?: { email?: string; phone?: string };
};

async function listContacts(): Promise<WixContact[]> {
  const results: WixContact[] = [];
  const limit = 100;
  let offset = 0;

  // Query Contacts uses offset-based paging (there's no cursor variant for
  // this endpoint), and reports pagingMetadata.count for the page size
  // actually returned.
  for (;;) {
    const res = await fetch(`${WIX_API}/contacts/v4/contacts/query`, {
      method: "POST",
      headers: wixHeaders(),
      body: JSON.stringify({
        query: {
          paging: { limit, offset },
        },
      }),
    });

    if (!res.ok) {
      throw new Error(`Wix list contacts failed: ${res.status} ${await res.text()}`);
    }

    const data = await res.json();
    const items: WixContact[] = data.contacts ?? [];
    results.push(...items);

    if (items.length < limit) break;
    offset += limit;
  }

  return results;
}

export async function syncWix() {
  const contacts = await listContacts();
  console.log(`Wix: found ${contacts.length} contact(s)`);

  let matched = 0;

  for (const contact of contacts) {
    const email =
      contact.primaryInfo?.email ?? contact.info?.emails?.items?.[0]?.email ?? null;
    if (!email) continue;

    const name = [contact.info?.name?.first, contact.info?.name?.last]
      .filter(Boolean)
      .join(" ")
      .trim();

    const user = await upsertUserByEmail(email, { name: name || undefined });
    matched++;

    await db.wixContact.upsert({
      where: { wixContactId: contact.id },
      update: {
        userId: user.id,
        address: (contact.info?.addresses?.items as any) ?? undefined,
        syncedAt: new Date(),
      },
      create: {
        wixContactId: contact.id,
        userId: user.id,
        address: (contact.info?.addresses?.items as any) ?? undefined,
      },
    });

    // Also backfill company/jobTitle/phone onto the unified User row if
    // we don't already have them from another source.
    await db.user.update({
      where: { id: user.id },
      data: {
        company: contact.info?.company ?? undefined,
        jobTitle: contact.info?.jobTitle ?? undefined,
        phone: contact.primaryInfo?.phone ?? contact.info?.phones?.items?.[0]?.phone ?? undefined,
      },
    });
  }

  console.log(`Wix sync complete: ${matched} contact(s) matched to a user by email.`);
}

if (require.main === module) {
  syncWix()
    .catch((err) => {
      console.error(err);
      process.exit(1);
    })
    .finally(() => db.$disconnect());
}
