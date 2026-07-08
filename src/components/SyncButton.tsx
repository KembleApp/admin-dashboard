"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export default function SyncButton() {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<string | null>(null);
  const router = useRouter();

  async function handleSync() {
    setStatus("Syncing…");
    const res = await fetch("/api/sync", { method: "POST" });
    const data = await res.json();
    const results: Record<string, string> = data.results ?? {};
    const failed = Object.entries(results).filter(([, v]) => !v.startsWith("ok"));

    setStatus(
      !res.ok
        ? `Sync request failed (${res.status})`
        : failed.length === 0
          ? "Synced"
          : failed.map(([name, err]) => `${name}: ${err}`).join(" | ")
    );
    startTransition(() => router.refresh());
    console.log("Sync results:", data.results);
    setTimeout(() => setStatus(null), failed.length === 0 ? 3000 : 15000);
  }

  return (
    <button
      onClick={handleSync}
      disabled={isPending}
      className="max-w-md truncate rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 disabled:opacity-50"
      title={status ?? undefined}
    >
      {status ?? "Sync now"}
    </button>
  );
}
