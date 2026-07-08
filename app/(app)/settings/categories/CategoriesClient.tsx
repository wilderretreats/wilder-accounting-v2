"use client";

import { useEffect, useState } from "react";
import { groupCategoriesByParent } from "@/lib/categories";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import type { CategoryType, CategoryWithParent } from "@/types";

const TYPE_LABELS: Record<CategoryType, string> = {
  revenue: "Revenue",
  cogs: "COGS",
  overhead: "Overhead",
};

export function CategoriesClient() {
  const [categories, setCategories] = useState<CategoryWithParent[]>([]);
  const [showInactive, setShowInactive] = useState(false);
  const [newType, setNewType] = useState<CategoryType>("cogs");
  const [newParentId, setNewParentId] = useState("");
  const [newName, setNewName] = useState("");

  async function load() {
    const params = new URLSearchParams();
    if (showInactive) params.set("includeInactive", "true");
    const res = await fetch(`/api/categories?${params}`);
    const data = await res.json();
    setCategories(data.categories ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showInactive]);

  async function toggleActive(cat: CategoryWithParent) {
    await fetch(`/api/categories/${cat.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !cat.is_active }),
    });
    load();
  }

  async function rename(cat: CategoryWithParent) {
    const name = prompt("Rename category", cat.name);
    if (!name || name === cat.name) return;
    await fetch(`/api/categories/${cat.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    load();
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: newType, name: newName, parentId: newParentId || null }),
    });
    setNewName("");
    setNewParentId("");
    load();
  }

  const topLevelForNewType = categories.filter((c) => c.type === newType && c.parent_id === null);

  return (
    <div className="flex flex-col gap-6">
      <label className="flex items-center gap-2 text-sm text-zinc-600">
        <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
        Show retired categories
      </label>

      {(["revenue", "cogs", "overhead"] as CategoryType[]).map((type) => {
        const grouped = groupCategoriesByParent(categories.filter((c) => c.type === type));
        return (
          <Card key={type}>
            <CardBody>
              <h2 className="mb-3 text-sm font-semibold text-zinc-900">{TYPE_LABELS[type]}</h2>
              <div className="flex flex-col gap-1">
                {grouped.map(({ parent, children }) => (
                  <div key={parent.id}>
                    <CategoryRow cat={parent} onToggle={toggleActive} onRename={rename} />
                    {children.map((child) => (
                      <div key={child.id} className="ml-6">
                        <CategoryRow cat={child} onToggle={toggleActive} onRename={rename} />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        );
      })}

      <Card>
        <CardBody>
          <h2 className="mb-3 text-sm font-semibold text-zinc-900">Add category</h2>
          <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-2">
            <Select
              value={newType}
              onChange={(e) => {
                setNewType(e.target.value as CategoryType);
                setNewParentId("");
              }}
            >
              <option value="revenue">Revenue</option>
              <option value="cogs">COGS</option>
              <option value="overhead">Overhead</option>
            </Select>
            {topLevelForNewType.length > 0 && (
              <Select value={newParentId} onChange={(e) => setNewParentId(e.target.value)}>
                <option value="">No parent (top-level)</option>
                {topLevelForNewType.map((p) => (
                  <option key={p.id} value={p.id}>
                    Under: {p.name}
                  </option>
                ))}
              </Select>
            )}
            <Input placeholder="Category name" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <Button type="submit">Add</Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}

function CategoryRow({
  cat,
  onToggle,
  onRename,
}: {
  cat: CategoryWithParent;
  onToggle: (c: CategoryWithParent) => void;
  onRename: (c: CategoryWithParent) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded px-2 py-1.5 hover:bg-zinc-50">
      <button onClick={() => onRename(cat)} className="text-left text-sm text-zinc-900 hover:underline">
        {cat.name}
      </button>
      <div className="flex items-center gap-2">
        {cat.is_flight_cost && <Badge tone="amber">AllFly</Badge>}
        {!cat.is_active && <Badge tone="neutral">Retired</Badge>}
        <button
          onClick={() => onToggle(cat)}
          className="text-xs text-zinc-400 hover:text-zinc-700"
        >
          {cat.is_active ? "Retire" : "Restore"}
        </button>
      </div>
    </div>
  );
}
