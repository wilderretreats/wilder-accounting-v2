"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePlaidLink } from "react-plaid-link";
import { PLAID_LINK_TOKEN_STORAGE_KEY } from "@/components/plaid/PlaidConnect";

/**
 * OAuth-institution redirect target (registered as PLAID_REDIRECT_URI in the
 * Plaid dashboard). Plaid Link sends the browser here mid-flow for banks
 * that require OAuth; we resume the same Link session using the token saved
 * to sessionStorage before the redirect out.
 */
export default function PlaidOAuthPage() {
  const router = useRouter();
  const [linkToken, setLinkToken] = useState<string | null>(null);

  useEffect(() => {
    setLinkToken(sessionStorage.getItem(PLAID_LINK_TOKEN_STORAGE_KEY));
  }, []);

  const { open, ready } = usePlaidLink({
    token: linkToken,
    receivedRedirectUri: typeof window !== "undefined" ? window.location.href : undefined,
    onSuccess: async (publicToken) => {
      sessionStorage.removeItem(PLAID_LINK_TOKEN_STORAGE_KEY);
      await fetch("/api/plaid/exchange-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicToken }),
      });
      router.push("/settings/bank?connected=1");
    },
    onExit: () => {
      router.push("/settings/bank");
    },
  });

  useEffect(() => {
    if (linkToken && ready) open();
  }, [linkToken, ready, open]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-zinc-500">Completing bank connection…</p>
    </div>
  );
}
