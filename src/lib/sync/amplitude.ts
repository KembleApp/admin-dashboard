/**
 * Amplitude sync — STUB. Not runnable yet: needs AMPLITUDE_API_KEY /
 * AMPLITUDE_SECRET_KEY (from Amplitude project Settings > Projects >
 * General) in .env.local, and hasn't been exercised against a live
 * project, since this sandbox has no network access to Amplitude's API.
 * Treat the request/response shapes below as "best effort from docs,"
 * verify against a real response before relying on it.
 *
 * Approach: Amplitude doesn't offer a single "list all users" endpoint.
 * The two realistic options are:
 *   1. Export API — bulk-export raw events for a date range, then derive
 *      per-user rollups (last seen, event counts, properties) yourself.
 *      https://amplitude.com/docs/apis/analytics/export
 *   2. User Profile API — look up one user at a time by user_id/device_id.
 *      https://amplitude.com/docs/apis/analytics/user-profile
 * This stub uses the Export API since the dashboard needs to enumerate
 * *all* users, not look up one at a time. Swap in Profile API calls if you
 * only ever need to refresh a single known user.
 */
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
};

/**
 * Export API returns a zip of gzipped NDJSON files for the given hour
 * range. Unzipping/gunzipping is left as TODO — reach for a library like
 * `adm-zip` + `zlib.gunzipSync`, or `jszip`, once this is wired up for
 * real. Sketch below shows the shape of the call and how events would be
 * folded into AmplitudeProfile once parsed.
 */
async function fetchRecentEvents(_startHour: string, _endHour: string): Promise<AmplitudeEvent[]> {
  const url = new URL("https://amplitude.com/api/2/export");
  url.searchParams.set("start", _startHour); // format: YYYYMMDDTHH
  url.searchParams.set("end", _endHour);

  const res = await fetch(url, { headers: basicAuthHeader() });
  if (!res.ok) {
    throw new Error(`Amplitude export failed: ${res.status} ${await res.text()}`);
  }

  // TODO: response body is a zip of .gz NDJSON files — unzip, gunzip, and
  // JSON.parse each line into AmplitudeEvent. Returning [] until that's
  // implemented so this compiles and fails loudly (not silently) if run.
  console.warn("Amplitude sync: zip/gzip parsing not yet implemented — returning no events.");
  return [];
}

export async function syncAmplitude() {
  const end = new Date();
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().slice(0, 13).replace(/[-:]/g, "").replace("T", "T");

  const events = await fetchRecentEvents(fmt(start), fmt(end));

  // Fold events into a per-user rollup, keyed by amplitude user_id.
  const byUser = new Map<string, AmplitudeEvent[]>();
  for (const event of events) {
    if (!event.user_id) continue;
    const list = byUser.get(event.user_id) ?? [];
    list.push(event);
    byUser.set(event.user_id, list);
  }

  for (const [amplitudeUserId, userEvents] of byUser) {
    const latest = userEvents[userEvents.length - 1];
    const email = (latest.user_properties?.email as string | undefined) ?? null;

    let userId: string | undefined;
    if (email) {
      const user = await upsertUserByEmail(email);
      userId = user.id;
    }

    if (!userId) continue; // can't attach an AmplitudeProfile without a User row

    await db.amplitudeProfile.upsert({
      where: { amplitudeUserId },
      update: {
        userId,
        deviceType: latest.device_type,
        platform: latest.platform,
        lastSeenAt: new Date(latest.event_time),
        totalEvents: userEvents.length,
        properties: latest.user_properties as any,
        recentEvents: userEvents.slice(-20) as any,
        syncedAt: new Date(),
      },
      create: {
        amplitudeUserId,
        userId,
        deviceType: latest.device_type,
        platform: latest.platform,
        lastSeenAt: new Date(latest.event_time),
        totalEvents: userEvents.length,
        properties: latest.user_properties as any,
        recentEvents: userEvents.slice(-20) as any,
      },
    });
  }

  console.log(`Amplitude sync complete: ${byUser.size} user(s) processed.`);
}

if (require.main === module) {
  syncAmplitude()
    .catch((err) => {
      console.error(err);
      process.exit(1);
    })
    .finally(() => db.$disconnect());
}
