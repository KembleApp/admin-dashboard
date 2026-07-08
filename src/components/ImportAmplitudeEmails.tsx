"use client";

import { useState } from "react";

export default function ImportAmplitudeEmails() {
  const [open, setOpen] = useState(false);
  const [csv, setCsv] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleImport() {
    setSubmitting(true);
    setStatus(null);
    const res = await fetch("/api/admin/amplitude-emails", {
      method: "POST",
      body: csv,
    });
    const data = await res.json();
    setStatus(res.ok ? `Imported ${data.imported} row(s).` : data.error ?? "Import failed");
    setSubmitting(false);
    if (res.ok) setCsv("");
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-sm text-slate-500 underline hover:text-slate-700"
      >
        Import Amplitude user_id → email mapping
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-700">
          Import Amplitude user_id → email mapping
        </h3>
        <button onClick={() => setOpen(false)} className="text-sm text-slate-400 hover:text-slate-600">
          Close
        </button>
      </div>
      <p className="mb-2 text-xs text-slate-500">
        Paste one pair per line, comma-separated: <code>amplitude_user_id,email</code> or{" "}
        <code>email,amplitude_user_id</code> (either order works; a header row is ignored).
      </p>
      <textarea
        value={csv}
        onChange={(e) => setCsv(e.target.value)}
        rows={8}
        placeholder={"96221244-b0e1-704a-6c46-f3a1f4d6b183,jane@example.com\n..."}
        className="w-full rounded-md border border-slate-300 p-2 font-mono text-xs"
      />
      <div className="mt-2 flex items-center gap-3">
        <button
          onClick={handleImport}
          disabled={submitting || !csv.trim()}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 disabled:opacity-50"
        >
          {submitting ? "Importing…" : "Import"}
        </button>
        {status && <span className="text-sm text-slate-500">{status}</span>}
      </div>
    </div>
  );
}
