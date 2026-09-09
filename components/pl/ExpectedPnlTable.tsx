"use client";

import { useEffect, useState } from "react";
import { PnlStatementTable } from "./PnlStatementTable";
import type { PnlStatement } from "@/types";

export function ExpectedPnlTable({ startMonth, endMonth }: { startMonth: string; endMonth: string }) {
  const [statement, setStatement] = useState<PnlStatement | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ startMonth, endMonth });
    fetch(`/api/pl/expected?${params}`)
      .then((r) => r.json())
      .then((d) => setStatement(d.statement ?? null))
      .finally(() => setLoading(false));
  }, [startMonth, endMonth]);

  if (loading || !statement) return <p className="text-sm text-zinc-400">Loading…</p>;

  return (
    <PnlStatementTable
      statement={statement}
      title="Expected, by month"
      note="Audited retreats use actual coded revenue/COGS. Ongoing retreats use contracted revenue and contracted COGS (contract value less contract profit) as a forecast."
    />
  );
}
