"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

interface ActiveLock {
  id: string;
  locked_at: string;
  locked_by_profile?: { full_name: string | null; email: string | null } | null;
}

export function LockControl({
  retreatId,
  activeLock,
  canUnlock,
}: {
  retreatId: string;
  activeLock: ActiveLock | null;
  canUnlock: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLock() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/retreats/${retreatId}/lock`, { method: "POST" });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(typeof data.error === "string" ? data.error : "Failed to lock");
      return;
    }
    router.refresh();
  }

  async function handleUnlock() {
    if (!confirm("Unlock this retreat? It can be re-coded until locked again.")) return;
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/retreats/${retreatId}/unlock`, { method: "POST" });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(typeof data.error === "string" ? data.error : "Failed to unlock");
      return;
    }
    router.refresh();
  }

  if (activeLock) {
    return (
      <div className="flex items-center justify-between rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3">
        <p className="text-sm text-emerald-800">
          Locked {formatDate(activeLock.locked_at)}
          {activeLock.locked_by_profile &&
            ` by ${activeLock.locked_by_profile.full_name ?? activeLock.locked_by_profile.email}`}
          . Transactions can&apos;t be recoded until unlocked.
        </p>
        {canUnlock && (
          <Button variant="secondary" onClick={handleUnlock} disabled={loading}>
            {loading ? "Unlocking…" : "Unlock"}
          </Button>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between rounded-md border border-zinc-200 bg-white px-4 py-3">
      <p className="text-sm text-zinc-600">Not locked — coding is open for this retreat.</p>
      <div className="flex items-center gap-3">
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button variant="secondary" onClick={handleLock} disabled={loading}>
          {loading ? "Locking…" : "Lock as reviewed"}
        </Button>
      </div>
    </div>
  );
}
