/**
 * Amplitude sync — pulls the full last 365 days of events from the Export
 * API (Amplitude's max query window) every run, unzips/gunzips the NDJSON
 * payload, and recomputes lifetime rollups per Amplitude user_id into an
 * AmplitudeProfile. Recomputing from full history each time (rather than
 * incrementally) is simple and avoids drift; at this app's current volume
 * (~18k events/month) a full year is ~2.6MB and fetches in a few seconds.
 * https://amplitude.com/docs/apis/analytics/export
 *
 * Note: a profile only links to a unified User if one of its events carries
 * an `email` user property. Verified against a live export: this project's
 * app currently does not send `email` via Amplitude identify/user
 * properties, so until the app is instrumented to do so, profiles will be
 * synced but left unlinked (no User match) unless there's a manual mapping
 * in AmplitudeEmailMap.
 */
import zlib from "node:zlib";
import AdmZip from "adm-zip";
import { db } from "@/lib/db";
import { upsertUserByEmail } from "@/lib/sync/util";

function basicAuthHeader(): HeadersInit {
  const key = process.env.AMPLITUDE_API_KEY;
  const secret = process.env.AMPLITUDE_SECRET_KEY;
  if (!key || !secret) {
    throw new Error("AMPLITUDE_API_KEY / AMPLITUDE_SECRET_KEY are not set in .env.local");
  }
  const token = Buffer.from(`${key}:${secret}`).toString("base64");
  return { Authorization: `Basic ${token}` };
}

type AmplitudeEvent = {
  user_id?: string;
  device_id?: string;
  device_type?: string;
  platform?: string;
  event_time: string;
  event_type: string;
  user_properties?: Record<string, unknown>;
  event_properties?: Record<string, unknown>;
};

// Event names verified against a live 30-day export (18,234 events, 83
// users) — see PR discussion for the full distinct event-type list. There's
// no event literally named "partner accepted" or "goal completed"; these
// are the closest confirmed real signals.
const SESSION_EVENT = "session_started";
const GOAL_COMPLETED_EVENT = "goal_creation_completed";
const GOAL_SHARED_EVENT = "goal_card_shared";
const PARTNER_INVITED_EVENT = "partner_invited";
// Fires with partner_count:1 - the closest real signal for "partner
// accepted the invite" (no such event exists directly).
const PARTNER_ACCEPTED_EVENT = "household_canvas_unlocked";
// Carries the accepting user's UUID on a shared-goal acceptance - the best
// available "partner's ID" signal (not literally an Amplitude user_id).
const GOAL_ACCEPTED_EVENT = "goal_card_accepted_onto_household_canvas";

/**
 * Export API returns a zip archive; each entry inside is itself a gzipped
 * NDJSON file (one event per line), named like
 * "<project_id>_<date>_<hour>#<part>.json.gz".
 */
async function fetchRecentEvents(startHour: string, endHour: string): Promise<AmplitudeEvent[]> {
  const url = new URL("https://amplitude.com/api/2/export");
  url.searchParams.set("start", startHour); // format: YYYYMMDDTHH
  url.searchParams.set("end", endHour);

  const res = await fetch(url, { headers: basicAuthHeader() });
  if (res.status === 404) {
    return []; // Amplitude returns 404 when there's no data for the range
  }
  if (!res.ok) {
    throw new Error(`Amplitude export failed: ${res.status} ${await res.text()}`);
  }

  const zip = new AdmZip(Buffer.from(await res.arrayBuffer()));
  const events: AmplitudeEvent[] = [];

  for (const entry of zip.getEntries()) {
    if (entry.isDirectory || !entry.entryName.endsWith(".json.gz")) continue;
    const ndjson = zlib.gunzipSync(entry.getData()).toString("utf8");
    for (const line of ndjson.split("\n")) {
      if (!line.trim()) continue;
      events.push(JSON.parse(line));
    }
  }

  return events;
}

/**
 * Amplitude's event_time is UTC but formatted as "YYYY-MM-DD HH:mm:ss.SSSSSS"
 * (space-separated, microseconds, no zone) — `new Date()` on that string
 * parses it as local time in Node, silently shifting it by the server's UTC
 * offset. Normalize to a real ISO string first.
 */
function parseAmplitudeTime(t: string): Date {
  const iso = t.replace(" ", "T").replace(/(\.\d{3})\d*$/, "$1") + "Z";
  return new Date(iso);
}

export async function syncAmplitude() {
  const end = new Date();
  const start = new Date(end.getTime() - 365 * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().slice(0, 13).replace(/[-:]/g, "");

  const events = await fetchRecentEvents(fmt(start), fmt(end));

  // Fold events into a per-user rollup, keyed by amplitude user_id.
  const byUser = new Map<string, AmplitudeEvent[]>();
  for (const event of events) {
    if (!event.user_id) continue;
    const list = byUser.get(event.user_id) ?? [];
    list.push(event);
    byUser.set(event.user_id, list);
  }

  // Manual fallback for apps (like this one) that don't send `email` as an
  // Amplitude user property — see AmplitudeEmailMap.
  const emailMap = new Map(
    (await db.amplitudeEmailMap.findMany()).map((row) => [row.amplitudeUserId, row.email])
  );

  let linked = 0;

  for (const [amplitudeUserId, userEvents] of byUser) {
    // Events aren't guaranteed to arrive in chronological order across
    // multiple hour files, so sort before treating the last one as "latest".
    userEvents.sort(
      (a, b) => parseAmplitudeTime(a.event_time).getTime() - parseAmplitudeTime(b.event_time).getTime()
    );
    const latest = userEvents[userEvents.length - 1];
    const earliest = userEvents[0];
    const email =
      (userEvents.map((e) => e.user_properties?.email as string | undefined).find(Boolean)) ??
      emailMap.get(amplitudeUserId) ??
      null;

    let userId: string | undefined;
    if (email) {
      const user = await upsertUserByEmail(email);
      userId = user.id;
      linked++;
    }

    if (!userId) continue; // can't attach an AmplitudeProfile without a User row

    const sessionCount = userEvents.filter((e) => e.event_type === SESSION_EVENT).length;
    const goalCompletedCount = userEvents.filter((e) => e.event_type === GOAL_COMPLETED_EVENT).length;
    const goalSharedCount = userEvents.filter((e) => e.event_type === GOAL_SHARED_EVENT).length;
    const partnerInvitedCount = userEvents.filter((e) => e.event_type === PARTNER_INVITED_EVENT).length;

    const partnerAcceptedEvent = [...userEvents]
      .reverse()
      .find((e) => e.event_type === PARTNER_ACCEPTED_EVENT);
    const goalAcceptedEvent = [...userEvents]
      .reverse()
      .find((e) => e.event_type === GOAL_ACCEPTED_EVENT && e.event_properties?.accepted_by);

    const fields = {
      userId,
      deviceType: latest.device_type,
      platform: latest.platform,
      lastSeenAt: parseAmplitudeTime(latest.event_time),
      firstSeenAt: parseAmplitudeTime(earliest.event_time),
      totalEvents: userEvents.length,
      sessionCount,
      goalCompletedCount,
      goalSharedCount,
      partnerInvitedCount,
      partnerAcceptedAt: partnerAcceptedEvent ? parseAmplitudeTime(partnerAcceptedEvent.event_time) : null,
      partnerUuid: (goalAcceptedEvent?.event_properties?.accepted_by as string | undefined) ?? null,
      properties: latest.user_properties as any,
      recentEvents: userEvents.slice(-20) as any,
    };

    await db.amplitudeProfile.upsert({
      where: { amplitudeUserId },
      update: { ...fields, syncedAt: new Date() },
      create: { amplitudeUserId, ...fields },
    });
  }

  console.log(
    `Amplitude sync complete: ${byUser.size} user(s) seen, ${linked} matched to a user by email.`
  );
}

if (require.main === module) {
  syncAmplitude()
    .catch((err) => {
      console.error(err);
      process.exit(1);
    })
    .finally(() => db.$disconnect());
}
