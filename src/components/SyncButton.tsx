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

async function syncOne(source: (typeof SOURCES)[number]): Promise<string> {
  try {
    const res = await fetch(`/api/sync/${source}`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) return `error: request failed (${res.status})`;
    return data.result as string;
  } catch (err) {
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
        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 disabled:opacity-50"
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
