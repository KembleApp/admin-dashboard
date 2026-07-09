"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type CustomFieldType = "TEXT" | "LONG_TEXT" | "LINK" | "LABEL";

type Props = {
  userId: string;
  fieldId: string;
  fieldName: string;
  fieldType: CustomFieldType;
  labelOptions: string[];
  value: string | null;
  labelValues: string[];
};

export default function CustomFieldRow({
  userId,
  fieldId,
  fieldName,
  fieldType,
  labelOptions,
  value,
  labelValues,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draftValue, setDraftValue] = useState(value ?? "");
  const [draftLabels, setDraftLabels] = useState<string[]>(labelValues);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function startEditing() {
    setDraftValue(value ?? "");
    setDraftLabels(labelValues);
    setError(null);
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/users/${userId}/custom-fields`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          fieldType === "LABEL" ? { fieldId, labelValues: draftLabels } : { fieldId, value: draftValue }
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Save failed");
        return;
      }
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setSaving(true);
    try {
      await fetch(`/api/users/${userId}/custom-fields?fieldId=${fieldId}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }

  function toggleLabel(option: string) {
    setDraftLabels((prev) => (prev.includes(option) ? prev.filter((l) => l !== option) : [...prev, option]));
  }

  if (!editing) {
    const display =
      fieldType === "LABEL"
        ? labelValues.length > 0
          ? labelValues.join(", ")
          : null
        : fieldType === "LINK" && value
          ? value
          : value;

    return (
      <div
        onClick={startEditing}
        className="group flex cursor-pointer justify-between gap-4 border-b border-slate-100 py-1.5 text-sm last:border-0"
        title="Click to edit"
      >
        <span className="shrink-0 text-slate-500">{fieldName}</span>
        <span className="truncate text-right text-slate-900 group-hover:underline">{display ?? "—"}</span>
      </div>
    );
  }

  return (
    <div className="border-b border-slate-100 py-1.5 text-sm last:border-0">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-slate-500">{fieldName}</span>
        <div className="flex items-center gap-1.5">
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
          <button onClick={remove} disabled={saving} className="text-xs text-red-500 hover:underline">
            Remove
          </button>
        </div>
      </div>

      {fieldType === "LABEL" ? (
        <div className="flex flex-wrap gap-1.5">
          {labelOptions.map((option) => {
            const selected = draftLabels.includes(option);
            return (
              <button
                key={option}
                onClick={() => toggleLabel(option)}
                className={`rounded-full border px-2.5 py-1 text-xs ${
                  selected
                    ? "border-kemble-coral bg-kemble-coral text-kemble-ink"
                    : "border-slate-300 text-slate-600 hover:border-slate-400"
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>
      ) : fieldType === "LONG_TEXT" ? (
        <textarea
          value={draftValue}
          onChange={(e) => setDraftValue(e.target.value)}
          autoFocus
          disabled={saving}
          rows={3}
          className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
        />
      ) : (
        <input
          type={fieldType === "LINK" ? "url" : "text"}
          value={draftValue}
          onChange={(e) => setDraftValue(e.target.value)}
          autoFocus
          disabled={saving}
          className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") setEditing(false);
          }}
        />
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
