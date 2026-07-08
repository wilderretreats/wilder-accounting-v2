"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Role } from "@/types";

const mainNav = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/transactions", label: "Transactions" },
  { href: "/clients", label: "Clients" },
  { href: "/retreats", label: "Retreats" },
  { href: "/reports", label: "Reports" },
  { href: "/reconcile", label: "Reconcile" },
  { href: "/audit", label: "Audit Log" },
];

const settingsNav = [
  { href: "/settings/bank", label: "Bank Connections" },
  { href: "/settings/categories", label: "Categories" },
  { href: "/settings/rules", label: "Auto-Coding Rules" },
  { href: "/settings/users", label: "Users" },
];

export function Sidebar({
  userEmail,
  fullName,
  role,
}: {
  userEmail: string;
  fullName: string | null;
  role: Role;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [settingsOpen, setSettingsOpen] = useState(pathname.startsWith("/settings"));

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-zinc-200 bg-white">
      <div className="border-b border-zinc-200 px-4 py-4">
        <p className="text-sm font-semibold text-zinc-900">Wilder Retreats</p>
        <p className="truncate text-xs text-zinc-500">{fullName ?? userEmail}</p>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <ul className="flex flex-col gap-0.5">
          {mainNav.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "block rounded-md px-3 py-2 text-sm font-medium",
                  pathname.startsWith(item.href)
                    ? "bg-zinc-900 text-white"
                    : "text-zinc-700 hover:bg-zinc-100"
                )}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>

        <button
          onClick={() => setSettingsOpen((v) => !v)}
          className="mt-4 flex w-full items-center justify-between rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-400 hover:text-zinc-600"
        >
          Settings
          <span>{settingsOpen ? "−" : "+"}</span>
        </button>
        {settingsOpen && (
          <ul className="flex flex-col gap-0.5">
            {settingsNav
              .filter((item) => item.href !== "/settings/users" || role === "admin")
              .map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "block rounded-md px-3 py-2 text-sm font-medium",
                      pathname.startsWith(item.href)
                        ? "bg-zinc-900 text-white"
                        : "text-zinc-700 hover:bg-zinc-100"
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
          </ul>
        )}
      </nav>

      <div className="border-t border-zinc-200 p-3">
        <button
          onClick={handleSignOut}
          className="w-full rounded-md px-3 py-2 text-left text-sm text-zinc-600 hover:bg-zinc-100"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
