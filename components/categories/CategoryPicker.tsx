"use client";

import { Fragment, useEffect, useState } from "react";
import { groupCategoriesByParent } from "@/lib/categories";
import type { CategoryType, CategoryWithParent } from "@/types";
import { Select, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const ADD_NEW_VALUE = "__add_new__";

const TYPE_LABELS: Record<CategoryType, string> = {
  revenue: "Revenue",
  cogs: "COGS",
  overhead: "Overhead",
};

interface CategoryPickerProps {
  value: string | null;
  onChange: (categoryId: string, type: CategoryType) => void;
  /** Restrict to one type (e.g. once a retreat is chosen, only revenue/cogs make sense). */
  typeFilter?: CategoryType;
  disabled?: boolean;
}

export function CategoryPicker({ value, onChange, typeFilter, disabled }: CategoryPickerProps) {
  const [categories, setCategories] = useState<CategoryWithParent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newType, setNewType] = useState<CategoryType>(typeFilter ?? "cogs");
  const [newParentId, setNewParentId] = useState("");
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadCategories() {
    setLoading(true);
    const res = await fetch("/api/categories");
    const data = await res.json();
    setCategories(data.categories ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSelectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    if (e.target.value === ADD_NEW_VALUE) {
      setShowAddForm(true);
      return;
    }
    const cat = categories.find((c) => c.id === e.target.value);
    if (cat) onChange(cat.id, cat.type);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: newType, name: newName, parentId: newParentId || null }),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Failed to create category");
      return;
    }

    await loadCategories();
    onChange(data.category.id, data.category.type);
    setShowAddForm(false);
    setNewName("");
    setNewParentId("");
  }

  if (showAddForm) {
    const topLevelForNewType = categories.filter((c) => c.type === newType && c.parent_id === null);
    return (
      <form onSubmit={handleCreate} className="flex flex-col gap-2 rounded-md border border-zinc-300 p-3">
        <div className="flex gap-2">
          {!typeFilter && (
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
          )}
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
        </div>
        <Input
          placeholder="New category name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          required
          autoFocus
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex gap-2">
          <Button type="submit" disabled={saving}>
            {saving ? "Adding…" : "Add category"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => setShowAddForm(false)}>
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  const types = (["revenue", "cogs", "overhead"] as CategoryType[]).filter(
    (t) => !typeFilter || t === typeFilter
  );

  return (
    <Select value={value ?? ""} onChange={handleSelectChange} disabled={disabled || loading}>
      <option value="" disabled>
        {loading ? "Loading categories…" : "Select a category"}
      </option>
      {types.map((type) => {
        const grouped = groupCategoriesByParent(categories.filter((c) => c.type === type));
        return (
          <optgroup key={type} label={TYPE_LABELS[type]}>
            {grouped.map(({ parent, children }) => (
              <Fragment key={parent.id}>
                <option value={parent.id}>{parent.name}</option>
                {children.map((child) => (
                  <option key={child.id} value={child.id}>
                    {"  — "}
                    {child.name}
                  </option>
                ))}
              </Fragment>
            ))}
          </optgroup>
        );
      })}
      <option value={ADD_NEW_VALUE}>+ Add new category…</option>
    </Select>
  );
}
