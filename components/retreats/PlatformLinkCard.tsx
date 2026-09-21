"use client";

import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";

interface PlatformRetreatOption {
  id: string;
  name: string;
  slug: string;
  organization_name: string | null;
}

export function PlatformLinkCard({ retreatId }: { retreatId: string }) {
  const [loading, setLoading] = useState(true);
  const [options, setOptions] = useState<PlatformRetreatOption[]>([]);
  const [selected, setSelected] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/retreats/${retreatId}/platform-link`)
      .then((r) => r.json())
      .then((d) => {
        setOptions(d.options ?? []);
        setSelected(d.current?.id ?? "");
      })
      .finally(() => setLoading(false));
  }, [retreatId]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/retreats/${retreatId}/platform-link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platformRetreatId: selected || null }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json();
      setError(typeof data.error === "string" ? data.error : "Failed to save link.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-semibold text-zinc-900">Wilder Retreats Platform link</h2>
      </CardHeader>
      <CardBody>
        {loading ? (
          <p className="text-sm text-zinc-400">Loading…</p>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-zinc-500">
              Links this retreat to its counterpart in the client portal — powers that portal&apos;s
              Accounting, Payments, and Pricing tabs. Can also be set from that retreat&apos;s
              Settings page in the portal itself.
            </p>
            <div className="flex items-center gap-2">
              <Select value={selected} onChange={(e) => setSelected(e.target.value)} className="flex-1">
                <option value="">Not linked</option>
                {options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} — {o.organization_name ?? "Unknown client"}
                  </option>
                ))}
              </Select>
              <Button type="button" onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
