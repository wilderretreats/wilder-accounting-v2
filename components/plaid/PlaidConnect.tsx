"use client";

import { useCallback, useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";

export const PLAID_LINK_TOKEN_STORAGE_KEY = "wilder_plaid_link_token";

interface PlaidAccountRow {
  id: string;
  name: string;
  mask: string | null;
  subtype: string | null;
}

interface PlaidItemRow {
  id: string;
  institution_name: string | null;
  status: "active" | "error" | "disconnected";
  last_sync_at: string | null;
  last_sync_error: string | null;
  plaid_accounts: PlaidAccountRow[];
}

export function PlaidConnect() {
  const [items, setItems] = useState<PlaidItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncingItemId, setSyncingItemId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    const res = await fetch("/api/plaid/items");
    const data = await res.json();
    setItems(data.items ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const onSuccess = useCallback(
    async (publicToken: string) => {
      sessionStorage.removeItem(PLAID_LINK_TOKEN_STORAGE_KEY);
      setError(null);
      const res = await fetch("/api/plaid/exchange-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Failed to connect account");
        return;
      }
      await loadItems();
    },
    [loadItems]
  );

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
    onExit: (err) => {
      if (err) setError(err.display_message || err.error_message || "Connection was cancelled");
    },
  });

  useEffect(() => {
    if (linkToken && ready) open();
  }, [linkToken, ready, open]);

  async function handleConnect() {
    setError(null);
    const res = await fetch("/api/plaid/create-link-token", { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      const detail = data.plaidError?.error_message || data.plaidError?.error_code;
      setError(detail ? `${detail}` : typeof data.error === "string" ? data.error : "Failed to start Plaid Link");
      return;
    }
    sessionStorage.setItem(PLAID_LINK_TOKEN_STORAGE_KEY, data.linkToken);
    setLinkToken(data.linkToken);
  }

  async function handleSyncAll() {
    setSyncingAll(true);
    setError(null);
    const res = await fetch("/api/plaid/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const data = await res.json();
    setSyncingAll(false);
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Sync failed");
      return;
    }
    await loadItems();
  }

  async function handleSyncOne(itemId: string) {
    setSyncingItemId(itemId);
    setError(null);
    const res = await fetch("/api/plaid/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId }),
    });
    const data = await res.json();
    setSyncingItemId(null);
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Sync failed");
      return;
    }
    await loadItems();
  }

  async function handleDisconnect(itemId: string) {
    if (!confirm("Disconnect this bank account? Historical transactions stay, but syncing stops.")) return;
    const res = await fetch(`/api/plaid/items/${itemId}`, { method: "DELETE" });
    if (res.ok) await loadItems();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <Button onClick={handleConnect}>Connect a bank account</Button>
        {items.length > 0 && (
          <Button variant="secondary" onClick={handleSyncAll} disabled={syncingAll}>
            {syncingAll ? "Syncing…" : "Sync all"}
          </Button>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && items.length === 0 && (
        <p className="text-sm text-zinc-400">No bank accounts connected yet.</p>
      )}

      {items.map((item) => (
        <Card key={item.id}>
          <CardBody className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-zinc-900">{item.institution_name ?? "Connected account"}</p>
                <p className="text-xs text-zinc-500">
                  {item.status === "disconnected"
                    ? "Disconnected"
                    : item.status === "error"
                      ? `Error: ${item.last_sync_error ?? "unknown"}`
                      : item.last_sync_at
                        ? `Last synced ${new Date(item.last_sync_at).toLocaleString()}`
                        : "Not synced yet"}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => handleSyncOne(item.id)}
                  disabled={syncingItemId === item.id || item.status === "disconnected"}
                >
                  {syncingItemId === item.id ? "Syncing…" : "Sync now"}
                </Button>
                {item.status !== "disconnected" && (
                  <Button variant="danger" onClick={() => handleDisconnect(item.id)}>
                    Disconnect
                  </Button>
                )}
              </div>
            </div>
            {item.plaid_accounts.length > 0 && (
              <ul className="text-xs text-zinc-500">
                {item.plaid_accounts.map((a) => (
                  <li key={a.id}>
                    {a.name} {a.mask && `••${a.mask}`} {a.subtype && `(${a.subtype})`}
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
