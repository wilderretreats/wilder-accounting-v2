"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatPercent } from "@/lib/utils";

interface ContractDetailsCardProps {
  retreatId: string;
  contractValue: number | null;
  contractProfit: number | null;
  passengerCount: number | null;
  /** The retreat's current coded revenue, whatever the audit status -- not the blended "expected" figure. */
  actualRevenue: number;
}

function parseOptionalNumber(input: string): number | null | undefined {
  const trimmed = input.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isNaN(n) ? undefined : n;
}

export function ContractDetailsCard({
  retreatId,
  contractValue,
  contractProfit,
  passengerCount,
  actualRevenue,
}: ContractDetailsCardProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [valueInput, setValueInput] = useState(contractValue?.toString() ?? "");
  const [profitInput, setProfitInput] = useState(contractProfit?.toString() ?? "");
  const [passengersInput, setPassengersInput] = useState(passengerCount?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetInputs() {
    setValueInput(contractValue?.toString() ?? "");
    setProfitInput(contractProfit?.toString() ?? "");
    setPassengersInput(passengerCount?.toString() ?? "");
    setError(null);
  }

  async function handleSave() {
    const parsedValue = parseOptionalNumber(valueInput);
    const parsedProfit = parseOptionalNumber(profitInput);
    const parsedPassengers = parseOptionalNumber(passengersInput);

    if (parsedValue === undefined || parsedProfit === undefined || parsedPassengers === undefined) {
      setError("Enter valid numbers.");
      return;
    }

    setSaving(true);
    setError(null);
    const res = await fetch(`/api/retreats/${retreatId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contractValue: parsedValue,
        contractProfit: parsedProfit,
        passengerCount: parsedPassengers !== null ? Math.round(parsedPassengers) : null,
      }),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Failed to save contract details.");
      return;
    }
    setEditing(false);
    router.refresh();
  }

  const diff = contractValue !== null ? actualRevenue - contractValue : null;
  const diffPercent = contractValue !== null && contractValue !== 0 ? (diff as number) / contractValue : null;

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-900">Contract</h2>
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-sm text-zinc-500 hover:underline"
          >
            Edit
          </button>
        )}
      </CardHeader>
      <CardBody>
        {editing ? (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Contract value</label>
                <Input
                  type="number"
                  step="0.01"
                  value={valueInput}
                  onChange={(e) => setValueInput(e.target.value)}
                  placeholder="0.00"
                  autoFocus
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Contract profit</label>
                <Input
                  type="number"
                  step="0.01"
                  value={profitInput}
                  onChange={(e) => setProfitInput(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Passengers</label>
                <Input
                  type="number"
                  step="1"
                  min="0"
                  value={passengersInput}
                  onChange={(e) => setPassengersInput(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2">
              <Button type="button" onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setEditing(false);
                  resetInputs();
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            <Stat label="Contract Value" value={contractValue !== null ? formatCurrency(contractValue) : "—"} />
            <Stat label="Contract Profit" value={contractProfit !== null ? formatCurrency(contractProfit) : "—"} />
            <Stat label="Passengers" value={passengerCount !== null ? String(passengerCount) : "—"} />
            <Stat
              label="Revenue vs Contract"
              value={diff !== null ? formatCurrency(diff) : "—"}
              tone={diff === null ? undefined : diff >= 0 ? "positive" : "negative"}
            />
            <Stat
              label="Revenue vs Contract %"
              value={formatPercent(diffPercent)}
              tone={diffPercent === null ? undefined : diffPercent >= 0 ? "positive" : "negative"}
            />
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative";
}) {
  const colorClass =
    tone === "positive" ? "text-emerald-700" : tone === "negative" ? "text-red-600" : "text-zinc-900";
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${colorClass}`}>{value}</p>
    </div>
  );
}
