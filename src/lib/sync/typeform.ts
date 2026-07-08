/**
 * Typeform sync — WORKING, given a valid TYPEFORM_TOKEN.
 *
 * Pulls every form, then every response on each form, and upserts them
 * into TypeformResponse. If a response contains an email-type answer, it's
 * matched/created against the unified User table.
 *
 * Run directly:   npm run sync:typeform
 * Or import syncTypeform() and call it from a cron/API route.
 */
import { db } from "@/lib/db";
import { upsertUserByEmail } from "@/lib/sync/util";

const TYPEFORM_API = "https://api.typeform.com";

type TypeformForm = { id: string; title: string };

type TypeformAnswer = {
  field: { id: string; type: string; ref?: string };
  type: string;
  text?: string;
  email?: string;
  choice?: { label?: string };
  choices?: { labels?: string[] };
  number?: number;
  boolean?: boolean;
  date?: string;
  url?: string;
};

type TypeformResponseItem = {
  response_id: string;
  submitted_at: string;
  answers: TypeformAnswer[];
};

function authHeader(): HeadersInit {
  const token = process.env.TYPEFORM_TOKEN;
  if (!token) {
    throw new Error("TYPEFORM_TOKEN is not set in .env.local");
  }
  return { Authorization: `Bearer ${token}` };
}

async function listForms(): Promise<TypeformForm[]> {
  const res = await fetch(`${TYPEFORM_API}/forms?page_size=200`, {
    headers: authHeader(),
  });
  if (!res.ok) {
    throw new Error(`Typeform list forms failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return (data.items ?? []).map((f: any) => ({ id: f.id, title: f.title }));
}

async function listResponses(formId: string): Promise<TypeformResponseItem[]> {
  const results: TypeformResponseItem[] = [];
  let before: string | undefined;

  // Typeform paginates responses via the `before` response_id cursor.
  // Loop until a page comes back smaller than the page size.
  for (;;) {
    const url = new URL(`${TYPEFORM_API}/forms/${formId}/responses`);
    url.searchParams.set("page_size", "1000");
    if (before) url.searchParams.set("before", before);

    const res = await fetch(url, { headers: authHeader() });
    if (!res.ok) {
      throw new Error(
        `Typeform list responses failed for form ${formId}: ${res.status} ${await res.text()}`
      );
    }
    const data = await res.json();
    const items: TypeformResponseItem[] = data.items ?? [];
    results.push(...items);

    if (items.length < 1000) break;
    before = items[items.length - 1].response_id;
  }

  return results;
}

function extractEmail(answers: TypeformAnswer[]): string | null {
  const emailAnswer = answers.find((a) => a.type === "email" && a.email);
  return emailAnswer?.email ?? null;
}

export async function syncTypeform() {
  const forms = await listForms();
  console.log(`Typeform: found ${forms.length} form(s)`);

  let totalResponses = 0;
  let matchedToUser = 0;

  for (const form of forms) {
    const responses = await listResponses(form.id);
    console.log(`  "${form.title}" (${form.id}): ${responses.length} response(s)`);

    for (const response of responses) {
      const email = extractEmail(response.answers);
      let userId: string | undefined;

      if (email) {
        const user = await upsertUserByEmail(email);
        userId = user.id;
        matchedToUser++;
      }

      await db.typeformResponse.upsert({
        where: { responseId: response.response_id },
        update: {
          userId,
          formTitle: form.title,
          answers: response.answers as any,
          submittedAt: response.submitted_at ? new Date(response.submitted_at) : null,
          syncedAt: new Date(),
        },
        create: {
          responseId: response.response_id,
          formId: form.id,
          formTitle: form.title,
          userId,
          answers: response.answers as any,
          submittedAt: response.submitted_at ? new Date(response.submitted_at) : null,
        },
      });
      totalResponses++;
    }
  }

  console.log(
    `Typeform sync complete: ${totalResponses} response(s) synced, ${matchedToUser} matched to a user by email.`
  );
}

// Allow `npm run sync:typeform` to run this file directly.
if (require.main === module) {
  syncTypeform()
    .catch((err) => {
      console.error(err);
      process.exit(1);
    })
    .finally(() => db.$disconnect());
}
