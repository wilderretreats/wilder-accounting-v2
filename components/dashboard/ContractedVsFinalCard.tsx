import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { formatCurrency, formatPercent } from "@/lib/utils";

interface ComparisonRow {
  label: string;
  contracted: number;
  final: number;
}

export function ContractedVsFinalCard({ revenue, profit }: { revenue: ComparisonRow; profit: ComparisonRow }) {
  const rows = [revenue, profit];

  return (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-semibold text-zinc-900">Contracted vs Final</h2>
      </CardHeader>
      <CardBody className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-zinc-500">
              <th className="pb-2 pr-4"></th>
              <th className="pb-2 pr-4 text-right">Contracted</th>
              <th className="pb-2 pr-4 text-right">Final</th>
              <th className="pb-2 pr-4 text-right">Difference</th>
              <th className="pb-2 text-right">Difference %</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const diff = r.final - r.contracted;
              const diffPercent = r.contracted !== 0 ? diff / r.contracted : null;
              const diffClass = diff >= 0 ? "text-emerald-700" : "text-red-600";
              return (
                <tr key={r.label} className="border-t border-zinc-100">
                  <td className="py-2 pr-4 font-medium text-zinc-900">{r.label}</td>
                  <td className="py-2 pr-4 text-right text-zinc-700">{formatCurrency(r.contracted)}</td>
                  <td className="py-2 pr-4 text-right text-zinc-700">{formatCurrency(r.final)}</td>
                  <td className={`py-2 pr-4 text-right font-medium ${diffClass}`}>{formatCurrency(diff)}</td>
                  <td className={`py-2 text-right font-medium ${diffClass}`}>{formatPercent(diffPercent)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardBody>
    </Card>
  );
}
