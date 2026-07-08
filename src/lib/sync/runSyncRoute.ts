import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// Shared by the three per-service sync routes so each can run as its own
// Vercel Function invocation (its own full maxDuration budget) instead of
// sharing one window across all three sequentially.
export async function runSyncRoute(name: string, fn: () => Promise<void>) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await fn();
    return NextResponse.json({ name, result: "ok" });
  } catch (err) {
    return NextResponse.json({
      name,
      result: `error: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
}
