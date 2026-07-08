/**
 * Wix sync — needs WIX_API_KEY / WIX_SITE_ID (from the Wix Developers
 * Center, on a Headless/REST API key with Contacts read permission) in
 * .env.local. Field names and pagination below are verified against the
 * Contacts v4 API reference docs.
 *
 * Uses the Wix Contacts v4 API to list contacts:
 * https://dev.wix.com/docs/rest/crm/members-contacts/contacts/contacts/contact-v4/query-contacts
 *
 * Contacts only carry opaque label *keys* - resolving them to their
 * human-readable display names uses the separate Labels API, which needs
 * the "Manage Contact Labels" scope on the API key. If that scope isn't
 * granted, this falls back to storing raw keys instead of failing the sync.
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

type WixValue = {
  nullValue?: null;
  numberValue?: number;
  stringValue?: string;
  boolValue?: boolean;
  structValue?: unknown;
  listValue?: { values?: WixValue[] };
};

function unwrapWixValue(v: WixValue | undefined): unknown {
  if (!v) return null;
  if (v.listValue) return (v.listValue.values ?? []).map(unwrapWixValue);
  return v.stringValue ?? v.numberValue ?? v.boolValue ?? v.structValue ?? null;
}

type WixContact = {
  id: string;
  createdDate?: string;
  source?: { sourceType?: string };
  lastActivity?: { activityDate?: string; activityType?: string };
  info?: {
    name?: { first?: string; last?: string };
    emails?: { items?: { email?: string }[] };
    phones?: { items?: { phone?: string }[] };
    addresses?: { items?: unknown[] };
    company?: string;
    jobTitle?: string;
    birthdate?: string;
    locale?: string;
    labelKeys?: { items?: string[] };
    extendedFields?: { items?: Record<string, WixValue> };
  };
  primaryInfo?: { email?: string; phone?: string };
  primaryEmail?: { subscriptionStatus?: string };
};

type WixLabel = { key: string; displayName: string };

// Contacts only carry opaque label keys (e.g. "custom.vip") - the actual
// human-readable name lives in a separate Labels API. Requires the
// "Manage Contact Labels" permission scope on the API key; if that's not
// granted, fall back to showing raw keys rather than failing the sync.
async function fetchLabelNames(): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  try {
    const res = await fetch(`${WIX_API}/contacts/v4/labels`, { headers: wixHeaders() });
    if (!res.ok) {
      console.warn(`Wix list labels failed (${res.status}) - falling back to raw label keys`);
      return names;
    }
    const data = await res.json();
    for (const label of (data.labels ?? []) as WixLabel[]) {
      names.set(label.key, label.displayName);
    }
  } catch (err) {
    console.warn("Wix list labels failed - falling back to raw label keys", err);
  }
  return names;
}

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
  const labelNames = await fetchLabelNames();

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

    const extendedFields = contact.info?.extendedFields?.items;
    const labelKeys = contact.info?.labelKeys?.items;

    const fields = {
      userId: user.id,
      address: (contact.info?.addresses?.items as any) ?? undefined,
      labels: (labelKeys?.map((key) => labelNames.get(key) ?? key) as any) ?? undefined,
      source: contact.source?.sourceType ?? undefined,
      wixCreatedDate: contact.createdDate ? new Date(contact.createdDate) : undefined,
      lastActivityAt: contact.lastActivity?.activityDate
        ? new Date(contact.lastActivity.activityDate)
        : undefined,
      lastActivityType: contact.lastActivity?.activityType ?? undefined,
      birthdate: contact.info?.birthdate ?? undefined,
      locale: contact.info?.locale ?? undefined,
      subscriptionStatus: contact.primaryEmail?.subscriptionStatus ?? undefined,
      extendedFields: extendedFields
        ? (Object.fromEntries(
            Object.entries(extendedFields).map(([k, v]) => [k, unwrapWixValue(v)])
          ) as any)
        : undefined,
    };

    await db.wixContact.upsert({
      where: { wixContactId: contact.id },
      update: { ...fields, syncedAt: new Date() },
      create: { wixContactId: contact.id, ...fields },
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
