"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Maps known account digits to a friendly name; anything not listed here
// just falls back to the raw digits pulled from the filename.
const ACCOUNT_NAMES_BY_DIGITS: Record<string, string> = {
  "7300": "Checking",
};

/**
 * Bank export filenames in this org follow `Chase<account digits>_Activity_*`
 * (e.g. "Chase7300_Activity_20260709.csv") -- pulling the digits out lets the
 * account label prefill itself instead of the user retyping it every import.
 */
function deriveAccountLabel(fileName: string): string | null {
  const match = fileName.match(/chase\s*#?(\d{3,5})/i);
  if (!match) return null;
  const digits = match[1];
  return ACCOUNT_NAMES_BY_DIGITS[digits] ?? digits;
}

export function ImportModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [accountLabel, setAccountLabel] = useState("");
  const [replaceAll, setReplaceAll] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ imported: number; autoCoded: number } | null>(null);

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("accountLabel", accountLabel);
    formData.append("replaceAll", String(replaceAll));

    const res = await fetch("/api/import", { method: "POST", body: formData });
    const data = await res.json();
    setUploading(false);

    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Import failed");
      return;
    }
    setResult(data);
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div
        className="flex w-full max-w-md flex-col gap-4 rounded-lg bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-zinc-900">Import transactions from CSV</h2>

        {result ? (
          <>
            <p className="text-sm text-zinc-700">
              Imported {result.imported} transaction{result.imported === 1 ? "" : "s"}
              {result.autoCoded > 0 && ` — ${result.autoCoded} auto-coded as Overhead`}.
            </p>
            <Button
              onClick={() => {
                onImported();
                onClose();
              }}
            >
              Done
            </Button>
          </>
        ) : (
          <>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">CSV file</label>
              <input
                type="file"
                onChange={(e) => {
                  const selected = e.target.files?.[0] ?? null;
                  setFile(selected);
                  if (selected && !accountLabel.trim()) {
                    const derived = deriveAccountLabel(selected.name);
                    if (derived) setAccountLabel(derived);
                  }
                }}
                className="block w-full text-sm"
              />
              <p className="mt-1 text-xs text-zinc-400">
                Needs Date, Description, and Amount columns (or Debit/Credit).
              </p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Account label (optional)
              </label>
              <Input
                placeholder="e.g. Chase Checking ••7308"
                value={accountLabel}
                onChange={(e) => setAccountLabel(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={replaceAll}
                onChange={(e) => setReplaceAll(e.target.checked)}
              />
              Replace existing CSV-imported transactions for this account
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2">
              <Button onClick={handleUpload} disabled={!file || uploading} className="flex-1">
                {uploading ? "Uploading…" : "Import"}
              </Button>
              <Button variant="secondary" onClick={onClose} disabled={uploading}>
                Cancel
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
