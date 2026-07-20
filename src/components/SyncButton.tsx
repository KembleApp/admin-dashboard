"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Toast = { message: string; isError: boolean };

// Each source gets its own request/Vercel Function invocation (its own full
// maxDuration budget) and runs in parallel, rather than sharing one window
// sequentially - a slow Amplitude pull no longer risks timing out Wix/
// Typeform along with it, and total wall time is bounded by the slowest one
// instead of the sum of all three.
const SOURCES = ["typeform", "amplitude", "wix"] as const;

// Matches the routes' `maxDuration = 300` (+ a small buffer). Without this,
// a hung connection or a function that gets killed without a clean HTTP
// response leaves fetch() waiting indefinitely - the button would show
// "Syncing..." forever instead of surfacing a clear error to retry.
const SYNC_TIMEOUT_MS = 310_000;

async function syncOne(source: (typeof SOURCES)[number]): Promise<string> {
  try {
    const res = await fetch(`/api/sync/${source}`, {
      method: "POST",
      signal: AbortSignal.timeout(SYNC_TIMEOUT_MS),
    });
    const data = await res.json();
    if (!res.ok) return `error: request failed (${res.status})`;
    return data.result as string;
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      return `error: timed out after ${SYNC_TIMEOUT_MS / 1000}s`;
    }
    return `error: ${err instanceof Error ? err.message : String(err)}`;
  }
}

export default function SyncButton() {
  const [isPending, startTransition] = useTransition();
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const router = useRouter();

  async function handleSync() {
    setSyncing(true);
    const results = await Promise.all(SOURCES.map((source) => syncOne(source)));
    const failed = SOURCES.map((source, i) => [source, results[i]] as const).filter(
      ([, r]) => !r.startsWith("ok")
    );

    setSyncing(false);
    setToast(
      failed.length === 0
        ? { message: "Sync complete", isError: false }
        : { message: failed.map(([name, err]) => `${name}: ${err}`).join(" | "), isError: true }
    );
    startTransition(() => router.refresh());
    console.log("Sync results:", Object.fromEntries(SOURCES.map((s, i) => [s, results[i]])));
    setTimeout(() => setToast(null), failed.length === 0 ? 3000 : 15000);
  }

  return (
    <>
      <button
        onClick={handleSync}
        disabled={isPending || syncing}
        className="rounded-md bg-kemble-ink px-3 py-1.5 text-sm text-white hover:bg-kemble-navy disabled:opacity-50"
      >
        {syncing ? "Syncing…" : "Sync now"}
      </button>

      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 max-w-sm rounded-md border px-4 py-3 text-sm shadow-lg ${
            toast.isError
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-green-200 bg-green-50 text-green-800"
          }`}
        >
          {toast.message}
        </div>
      )}
    </>
  );
}
