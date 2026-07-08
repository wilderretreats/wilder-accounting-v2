"use client";

import { useState } from "react";
import { Card, CardBody } from "@/components/ui/card";
import { formatCurrency, formatPercent } from "@/lib/utils";
import type { RetreatSummary } from "@/types";

export function RetreatSummaryCard({ summary }: { summary: RetreatSummary }) {
  const [exFlights, setExFlights] = useState(false);

  const cogs = exFlights ? summary.cogs_ex_flights : summary.cogs;
  const grossProfit = exFlights ? summary.gross_profit_ex_flights : summary.gross_profit;
  const margin = exFlights ? summary.margin_ex_flights : summary.margin;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-900">Financials</h2>
        {summary.flight_cogs > 0 && (
          <label className="flex items-center gap-2 text-sm text-zinc-600">
            <input
              type="checkbox"
              checked={exFlights}
              onChange={(e) => setExFlights(e.target.checked)}
            />
            Exclude flights (AllFly) — ground services only
          </label>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Revenue" value={formatCurrency(summary.revenue)} />
        <Stat label="COGS" value={formatCurrency(cogs)} />
        <Stat label="Gross Profit" value={formatCurrency(grossProfit)} />
        <Stat label="Margin" value={formatPercent(margin)} />
      </div>
      {exFlights && (
        <p className="text-xs text-zinc-400">
          Flights/Airfare cost of {formatCurrency(summary.flight_cogs)} excluded from COGS above.
          Revenue is unchanged either way.
        </p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardBody>
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
        <p className="mt-1 text-2xl font-semibold text-zinc-900">{value}</p>
      </CardBody>
    </Card>
  );
}
