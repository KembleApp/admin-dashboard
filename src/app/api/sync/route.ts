import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { syncTypeform } from "@/lib/sync/typeform";
import { syncAmplitude } from "@/lib/sync/amplitude";
import { syncWix } from "@/lib/sync/wix";

// Admin-triggered manual sync. For production, prefer a scheduled job
// (Vercel Cron, GitHub Action, etc.) hitting this route with a secret
// header instead of relying only on manual clicks.
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Record<string, string> = {};

  for (const [name, fn] of Object.entries({
    typeform: syncTypeform,
    amplitude: syncAmplitude,
    wix: syncWix,
  })) {
    try {
      await fn();
      results[name] = "ok";
    } catch (err) {
      results[name] = `error: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  return NextResponse.json({ results });
}
