"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { EditableModel, FieldKind } from "@/lib/editableFields";

type Props = {
  label: string;
  value: string | number | null;
  userId: string;
  model: EditableModel;
  field: string;
  kind: FieldKind;
};

export default function EditableField({ label, value, userId, model, field, kind }: Props) {
  const [editing, setEditing] = useState(false);
  const [current, setCurrent] = useState(value);
  const [draft, setDraft] = useState(value != null ? String(value) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function startEditing() {
    setDraft(current != null ? String(current) : "");
    setError(null);
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/users/${userId}/field`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, field, value: draft }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Save failed");
        return;
      }
      setCurrent(data.value);
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div
        onClick={startEditing}
        className="group flex cursor-pointer justify-between border-b border-slate-100 py-1.5 text-sm last:border-0"
        title="Click to edit"
      >
        <span className="text-slate-500">{label}</span>
        <span className="text-slate-900 group-hover:underline">{current ?? "—"}</span>
      </div>
    );
  }

  return (
    <div className="border-b border-slate-100 py-1.5 text-sm last:border-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-slate-500">{label}</span>
        <div className="flex items-center gap-1.5">
          <input
            type={kind === "number" ? "number" : "text"}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoFocus
            disabled={saving}
            className="w-40 rounded border border-slate-300 px-1.5 py-0.5 text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") setEditing(false);
            }}
          />
          <button
            onClick={save}
            disabled={saving}
            className="text-xs font-medium text-slate-900 hover:underline disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button onClick={() => setEditing(false)} className="text-xs text-slate-400 hover:underline">
            Cancel
          </button>
        </div>
      </div>
      {error && <p className="mt-1 text-right text-xs text-red-600">{error}</p>}
    </div>
  );
}
