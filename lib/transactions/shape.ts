import type { Transaction, TransactionCodingWithRelations, TransactionWithCoding } from "@/types";

/** The raw shape returned by a `.select("*, codings:transaction_codings(*, category:categories(*), retreat:retreats(*))")` query. */
export type RawTransactionWithCodings = Transaction & {
  codings: TransactionCodingWithRelations[] | null;
};

/**
 * Shared shaping for both the transactions list and detail GET routes.
 * Flattens `category`/`retreat` to the top level only for the common
 * single-coding case -- an arbitrary "first wins" pick would be misleading
 * once a transaction is split across multiple codings.
 */
export function shapeTransactionWithCoding(row: RawTransactionWithCodings): TransactionWithCoding {
  const codings = row.codings ?? [];
  const single = codings.length === 1 ? codings[0] : null;
  return {
    ...row,
    codings,
    category: single?.category ?? null,
    retreat: single?.retreat ?? null,
    isSplit: codings.length > 1,
  };
}
