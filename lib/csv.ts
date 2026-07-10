import Papa from "papaparse";

export interface ParsedCsvRow {
  date: string; // ISO date
  description: string;
  amount: number; // negative = money out, positive = money in
  accountLabel: string | null; // per-row card/account, when the export identifies it
}

const DATE_HEADERS = ["date", "transaction date", "posting date", "post date"];
const DESCRIPTION_HEADERS = ["description", "merchant", "name", "payee"];
const AMOUNT_HEADERS = ["amount", "transaction amount"];
// Some exports split debit/credit into two columns instead of one signed amount.
const DEBIT_HEADERS = ["debit", "withdrawal"];
const CREDIT_HEADERS = ["credit", "deposit"];
// Chase's business-card export bundles multiple physical cards into one file
// with a per-row "Card" column -- each row can belong to a different card,
// so this always wins over the single account label typed into the import
// form (which only applies as a fallback for exports that don't have this).
const CARD_HEADERS = ["card", "card number", "account", "account number"];

function normalizeHeader(h: string) {
  return h.trim().toLowerCase();
}

function findKey(row: Record<string, string>, candidates: string[]): string | undefined {
  const keys = Object.keys(row);
  return keys.find((k) => candidates.includes(normalizeHeader(k)));
}

function parseAmount(raw: string): number {
  const trimmed = raw.trim();
  const isParenNegative = /^\(.*\)$/.test(trimmed);
  const cleaned = trimmed.replace(/[()$,]/g, "");
  const value = parseFloat(cleaned);
  return isParenNegative ? -Math.abs(value) : value;
}

function parseDate(raw: string): string {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Could not parse date: "${raw}"`);
  }
  return d.toISOString().slice(0, 10);
}

/**
 * Parses a bank/card CSV export into normalized rows. Supports both a
 * single signed "Amount" column and split "Debit"/"Credit" columns (common
 * on checking-account exports). Amount sign convention matches the rest of
 * the app: negative = money out, positive = money in.
 */
export function parseTransactionCsv(csvText: string): ParsedCsvRow[] {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  // FieldMismatch (ragged rows -- e.g. Chase exports with a trailing empty
  // column) is harmless here since we only ever read named columns by
  // header, not by position. Anything else (bad quoting, bad delimiter)
  // means the file itself is corrupt and should still fail loudly.
  const fatalError = result.errors.find((e) => e.type !== "FieldMismatch");
  if (fatalError) {
    throw new Error(`CSV parse error: ${fatalError.message}`);
  }

  return result.data.map((row, i) => {
    const dateKey = findKey(row, DATE_HEADERS);
    const descKey = findKey(row, DESCRIPTION_HEADERS);
    const amountKey = findKey(row, AMOUNT_HEADERS);
    const debitKey = findKey(row, DEBIT_HEADERS);
    const creditKey = findKey(row, CREDIT_HEADERS);
    const cardKey = findKey(row, CARD_HEADERS);

    if (!dateKey || !descKey || (!amountKey && !debitKey && !creditKey)) {
      throw new Error(
        `Row ${i + 1}: could not find date/description/amount columns. ` +
          `Found headers: ${Object.keys(row).join(", ")}`
      );
    }

    let amount: number;
    if (amountKey) {
      amount = parseAmount(row[amountKey]);
    } else {
      const debit = debitKey && row[debitKey] ? parseAmount(row[debitKey]) : 0;
      const credit = creditKey && row[creditKey] ? parseAmount(row[creditKey]) : 0;
      amount = credit - Math.abs(debit);
    }

    return {
      date: parseDate(row[dateKey]),
      description: row[descKey].trim(),
      amount,
      accountLabel: cardKey && row[cardKey].trim() ? row[cardKey].trim() : null,
    };
  });
}
