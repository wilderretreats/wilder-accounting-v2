import Papa from "papaparse";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { CodedTransactionRow } from "./CodedTransactionsTable";

export interface RetreatExportInfo {
  retreatName: string;
  clientName: string | null;
  /** Shown in the PDF header when the table is filtered, e.g. "Category: Lodging". */
  filterLabel: string | null;
}

function fileBase(info: RetreatExportInfo) {
  const parts = [info.clientName, info.retreatName, "transactions"].filter(Boolean).join(" - ");
  return parts.replace(/[\\/:*?"<>|]+/g, "").trim();
}

function total(rows: CodedTransactionRow[]) {
  return rows.reduce((sum, r) => sum + r.amount, 0);
}

/** Downloads the given rows (already filtered/sorted as on screen) as a CSV, comments included. */
export function downloadRetreatCsv(rows: CodedTransactionRow[], info: RetreatExportInfo) {
  const data = rows.map((r) => ({
    Date: r.transaction?.posted_date ?? "",
    Description: r.transaction?.description ?? "",
    Category: r.category?.name ?? "",
    Account: r.transaction?.account_label ?? "",
    Pending: r.transaction?.pending ? "Yes" : "",
    Amount: r.amount.toFixed(2),
    Comment: r.comment ?? "",
  }));
  data.push({
    Date: "",
    Description: "Total",
    Category: "",
    Account: "",
    Pending: "",
    Amount: total(rows).toFixed(2),
    Comment: "",
  });

  // Leading BOM so Excel opens accented characters in descriptions/comments correctly.
  const csv = "﻿" + Papa.unparse(data);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileBase(info)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Opens a clean, print-ready page of the rows and triggers the print dialog,
 * where "Save as PDF" produces the file. Avoids a PDF library dependency and
 * keeps the app chrome (sidebar, buttons) out of the output.
 */
export function printRetreatPdf(rows: CodedTransactionRow[], info: RetreatExportInfo) {
  const win = window.open("", "_blank");
  if (!win) {
    alert("Your browser blocked the PDF window. Allow pop-ups for this site and try again.");
    return;
  }

  const sum = total(rows);
  const body = rows
    .map((r) => {
      const t = r.transaction;
      return `<tr>
        <td class="nowrap">${t ? esc(formatDate(t.posted_date)) : ""}</td>
        <td>${t?.pending ? '<span class="pending">Pending</span> ' : ""}${esc(t?.description ?? "")}</td>
        <td>${esc(r.category?.name ?? "")}</td>
        <td class="num ${r.amount < 0 ? "neg" : "pos"}">${esc(formatCurrency(r.amount))}</td>
        <td class="comment">${esc(r.comment ?? "")}</td>
      </tr>`;
    })
    .join("");

  const title = `${info.retreatName} — Transactions`;
  const generated = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  win.document.write(`<!doctype html>
<html><head><meta charset="utf-8"><title>${esc(fileBase(info))}</title>
<style>
  @page { size: letter landscape; margin: 0.5in; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; color: #18181b; font-size: 10.5px; margin: 24px; }
  @media print { body { margin: 0; } }
  .client { color: #71717a; font-size: 11px; margin: 0; }
  h1 { font-size: 17px; margin: 2px 0 4px; }
  .meta { color: #71717a; font-size: 10.5px; margin: 0 0 14px; }
  table { width: 100%; border-collapse: collapse; }
  thead { display: table-header-group; }
  th { text-align: left; font-weight: 600; color: #52525b; border-bottom: 1px solid #a1a1aa; padding: 5px 8px 5px 0; }
  td { border-bottom: 1px solid #e4e4e7; padding: 5px 8px 5px 0; vertical-align: top; }
  tr { page-break-inside: avoid; }
  .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  th.num { text-align: right; }
  .neg { color: #b91c1c; } .pos { color: #047857; }
  .nowrap { white-space: nowrap; }
  .comment { color: #3f3f46; width: 30%; white-space: pre-wrap; }
  .pending { display: inline-block; font-size: 9px; font-weight: 600; color: #b91c1c; border: 1px solid #fecaca; background: #fef2f2; border-radius: 3px; padding: 0 3px; }
  tfoot td { font-weight: 600; border-top: 1px solid #a1a1aa; border-bottom: none; }
</style></head><body>
  ${info.clientName ? `<p class="client">${esc(info.clientName)}</p>` : ""}
  <h1>${esc(title)}</h1>
  <p class="meta">${rows.length} transaction${rows.length === 1 ? "" : "s"}${
    info.filterLabel ? ` · ${esc(info.filterLabel)}` : ""
  } · Generated ${esc(generated)}</p>
  <table>
    <thead><tr><th>Date</th><th>Description</th><th>Category</th><th class="num">Amount</th><th>Comment</th></tr></thead>
    <tbody>${body || '<tr><td colspan="5">No transactions.</td></tr>'}</tbody>
    <tfoot><tr><td></td><td>Total</td><td></td><td class="num ${sum < 0 ? "neg" : "pos"}">${esc(
      formatCurrency(sum)
    )}</td><td></td></tr></tfoot>
  </table>
</body></html>`);
  win.document.close();
  win.focus();
  // Give the new document a beat to lay out before opening the print dialog.
  setTimeout(() => win.print(), 250);
}
