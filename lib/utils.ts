import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(amount);
}

/** `margin` is a ratio (e.g. 0.1953 -> "19.53%"), not a whole-number percent. */
export function formatPercent(margin: number | null): string {
  if (margin === null || Number.isNaN(margin)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  }).format(margin);
}

export function formatDate(isoDate: string): string {
  return new Date(isoDate + (isoDate.length === 10 ? "T00:00:00" : "")).toLocaleDateString(
    "en-US",
    { year: "numeric", month: "short", day: "numeric" }
  );
}

export function formatMonth(isoDate: string): string {
  return new Date(isoDate + "T00:00:00").toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
  });
}
