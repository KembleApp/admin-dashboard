"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type FieldType = "TEXT" | "LONG_TEXT" | "LINK" | "LABEL";

type FieldDef = { id: string; name: string; type: FieldType; labelOptions: string[] };

const TYPE_LABELS: Record<FieldType, string> = {
  TEXT: "Short plain text",
  LINK: "Link",
  LONG_TEXT: "Long description text",
  LABEL: "Label (multi-select)",
};

const NEW_FIELD = "__new__";

export default function AddCustomField({
  userId,
  existingFieldIds,
}: {
  userId: string;
  existingFieldIds: string[];
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<FieldDef[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");

  // New-field-definition state (only used when selectedId === NEW_FIELD).
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<FieldType>("TEXT");
  const [newOption, setNewOption] = useState("");
  const [newOptions, setNewOptions] = useState<string[]>([]);

  // Value state, for whichever field ends up selected/created.
  const [valueText, setValueText] = useState("");
  const [valueLabels, setValueLabels] = useState<string[]>([]);

  const router = useRouter();

  async function openPanel() {
    setOpen(true);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/custom-fields");
      const data = await res.json();
      setFields((data.fields ?? []).filter((f: FieldDef) => !existingFieldIds.includes(f.id)));
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setOpen(false);
    setSelectedId("");
    setNewName("");
    setNewType("TEXT");
    setNewOption("");
    setNewOptions([]);
    setValueText("");
    setValueLabels([]);
    setError(null);
  }

  function addOption() {
    const trimmed = newOption.trim();
    if (trimmed && !newOptions.includes(trimmed)) setNewOptions([...newOptions, trimmed]);
    setNewOption("");
  }

  const selectedExisting = fields.find((f) => f.id === selectedId);
  const activeType: FieldType | null = selectedId === NEW_FIELD ? newType : (selectedExisting?.type ?? null);
  const activeLabelOptions = selectedId === NEW_FIELD ? newOptions : (selectedExisting?.labelOptions ?? []);

  function toggleValueLabel(option: string) {
    setValueLabels((prev) => (prev.includes(option) ? prev.filter((l) => l !== option) : [...prev, option]));
  }

  async function save() {
    setError(null);

    if (selectedId === NEW_FIELD) {
      if (!newName.trim()) return setError("Field name is required");
      if (newType === "LABEL" && newOptions.length === 0) {
        return setError("Add at least one label option");
      }
    } else if (!selectedId) {
      return setError("Choose a field");
    }

    setSaving(true);
    try {
      let fieldId = selectedId;

      if (selectedId === NEW_FIELD) {
        const res = await fetch("/api/custom-fields", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newName.trim(), type: newType, labelOptions: newOptions }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Couldn't create field");
          return;
        }
        fieldId = data.field.id;
      }

      const res = await fetch(`/api/users/${userId}/custom-fields`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          activeType === "LABEL" ? { fieldId, labelValues: valueLabels } : { fieldId, value: valueText }
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't save value");
        return;
      }

      reset();
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button onClick={openPanel} className="text-xs font-medium text-slate-500 hover:underline">
        + Add field
      </button>
    );
  }

  return (
    <div className="mt-2 rounded-md border border-slate-200 p-3 text-sm">
      {loading ? (
        <p className="text-slate-400">Loading…</p>
      ) : (
        <>
          <label className="mb-1 block text-xs font-medium text-slate-500">Field</label>
          <select
            value={selectedId}
            onChange={(e) => {
              setSelectedId(e.target.value);
              setValueText("");
              setValueLabels([]);
            }}
            className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
          >
            <option value="" disabled>
              Choose a field…
            </option>
            {fields.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} ({TYPE_LABELS[f.type]})
              </option>
            ))}
            <option value={NEW_FIELD}>+ Create new field…</option>
          </select>

          {selectedId === NEW_FIELD && (
            <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">New field name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Priority"
                  className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Type</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as FieldType)}
                  className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                >
                  {(Object.keys(TYPE_LABELS) as FieldType[]).map((t) => (
                    <option key={t} value={t}>
                      {TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>

              {newType === "LABEL" && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">
                    Label options (the set anyone can be tagged with)
                  </label>
                  <div className="mb-1.5 flex flex-wrap gap-1.5">
                    {newOptions.map((o) => (
                      <span
                        key={o}
                        className="flex items-center gap-1 rounded-full border border-slate-300 px-2.5 py-1 text-xs text-slate-600"
                      >
                        {o}
                        <button
                          onClick={() => setNewOptions(newOptions.filter((x) => x !== o))}
                          className="text-slate-400 hover:text-slate-700"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={newOption}
                      onChange={(e) => setNewOption(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addOption();
                        }
                      }}
                      placeholder="Add an option"
                      className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
                    />
                    <button
                      onClick={addOption}
                      className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeType && (selectedId !== NEW_FIELD || newName.trim()) && (
            <div className="mt-3 border-t border-slate-100 pt-3">
              <label className="mb-1 block text-xs font-medium text-slate-500">Value for this person</label>
              {activeType === "LABEL" ? (
                activeLabelOptions.length === 0 ? (
                  <p className="text-xs text-slate-400">Add label options above first.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {activeLabelOptions.map((option) => {
                      const selected = valueLabels.includes(option);
                      return (
                        <button
                          key={option}
                          onClick={() => toggleValueLabel(option)}
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
                )
              ) : activeType === "LONG_TEXT" ? (
                <textarea
                  value={valueText}
                  onChange={(e) => setValueText(e.target.value)}
                  rows={3}
                  className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                />
              ) : (
                <input
                  type={activeType === "LINK" ? "url" : "text"}
                  value={valueText}
                  onChange={(e) => setValueText(e.target.value)}
                  className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                />
              )}
            </div>
          )}

          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="rounded-md border border-slate-300 px-3 py-1 text-xs font-medium hover:bg-slate-50 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save field"}
            </button>
            <button onClick={reset} className="text-xs text-slate-400 hover:underline">
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
}
