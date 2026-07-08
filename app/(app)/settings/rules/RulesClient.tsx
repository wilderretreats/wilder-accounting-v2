"use client";

import { useEffect, useState } from "react";
import { CategoryPicker } from "@/components/categories/CategoryPicker";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CategoryType } from "@/types";

interface Rule {
  id: string;
  keyword: string;
  category_id: string;
  priority: number;
  notes: string | null;
  category: { name: string; type: CategoryType } | null;
}

export function RulesClient() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [keyword, setKeyword] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/rules");
    const data = await res.json();
    setRules(data.rules ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!keyword.trim() || !categoryId) {
      setError("Enter a keyword and pick a category.");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword, categoryId }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json();
      setError(typeof data.error === "string" ? data.error : "Failed to add rule");
      return;
    }
    setKeyword("");
    setCategoryId(null);
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this rule?")) return;
    await fetch(`/api/rules/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-zinc-500">
        When a transaction description contains a rule&apos;s keyword, it can be auto-coded to that
        category. Only Overhead-type rules auto-apply fully (Revenue/COGS still need a retreat picked
        by hand). The longest matching keyword wins if more than one rule matches.
      </p>

      <Card>
        <CardBody>
          <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-2">
            <Input
              placeholder="Keyword (e.g. GOOGLE *ADS)"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="w-64"
            />
            <div className="w-64">
              <CategoryPicker value={categoryId} onChange={(id) => setCategoryId(id)} />
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? "Adding…" : "Add rule"}
            </Button>
          </form>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </CardBody>
      </Card>

      <Card>
        <CardBody className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-zinc-500">
                <th className="pb-2 pr-4">Keyword</th>
                <th className="pb-2 pr-4">Category</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id} className="border-t border-zinc-100">
                  <td className="py-2 pr-4 font-mono text-xs">{r.keyword}</td>
                  <td className="py-2 pr-4">
                    <Badge tone="blue">{r.category?.name ?? "—"}</Badge>
                  </td>
                  <td className="py-2 text-right">
                    <button
                      onClick={() => handleDelete(r.id)}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {rules.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-6 text-center text-zinc-400">
                    No rules yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </div>
  );
}
