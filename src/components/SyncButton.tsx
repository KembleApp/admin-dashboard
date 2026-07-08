"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Toast = { message: string; isError: boolean };

export default function SyncButton() {
  const [isPending, startTransition] = useTransition();
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const router = useRouter();

  async function handleSync() {
    setSyncing(true);
    let toastResult: Toast;
    let failedCount = 0;

    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const data = await res.json();
      const results: Record<string, string> = data.results ?? {};
      const failed = Object.entries(results).filter(([, v]) => !v.startsWith("ok"));
      failedCount = failed.length;

      toastResult = !res.ok
        ? { message: `Sync request failed (${res.status})`, isError: true }
        : failed.length === 0
          ? { message: "Sync complete", isError: false }
          : { message: failed.map(([name, err]) => `${name}: ${err}`).join(" | "), isError: true };
      console.log("Sync results:", data.results);
    } catch (err) {
      // Fetch/JSON failures (network error, timeout, non-JSON error page)
      // must still resolve the UI state - otherwise the button is stuck on
      // "Syncing…" forever with no toast, which is exactly what a silent
      // timeout looked like before this try/catch existed.
      failedCount = 1;
      toastResult = {
        message: `Sync failed: ${err instanceof Error ? err.message : String(err)}`,
        isError: true,
      };
    }

    setSyncing(false);
    setToast(toastResult);
    startTransition(() => router.refresh());
    setTimeout(() => setToast(null), failedCount === 0 ? 3000 : 15000);
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
