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
    setStatus(res.ok ? "Synced" : "Sync failed");
    startTransition(() => router.refresh());
    console.log("Sync results:", data.results);
    setTimeout(() => setStatus(null), 3000);
  }

  return (
    <button
      onClick={handleSync}
      disabled={isPending}
      className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 disabled:opacity-50"
    >
      {status ?? "Sync now"}
    </button>
  );
}
