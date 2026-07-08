// Hand-written to match supabase/migrations/*.sql exactly. Once the Supabase
// project exists, these can be cross-checked/regenerated with
// `supabase gen types typescript` — but report/computed types below stay
// hand-written regardless, since they don't correspond to real tables.

export type Role = "admin" | "ops" | "viewer";

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  role: Role;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OpsOwner {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface Client {
  id: string;
  name: string;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type CategoryType = "revenue" | "cogs" | "overhead";

export interface Category {
  id: string;
  type: CategoryType;
  parent_id: string | null;
  name: string;
  is_flight_cost: boolean;
  is_active: boolean;
  sort_order: number;
  created_by: string | null;
  created_at: string;
}

/** A category joined with its parent's name, for display in pickers/tables. */
export interface CategoryWithParent extends Category {
  parent_name: string | null;
}

export type RetreatStatus =
  | "upcoming"
  | "in_progress"
  | "completed"
  | "cancelled";

export interface Retreat {
  id: string;
  client_id: string;
  name: string;
  /** ISO date string, always the first of the month. */
  retreat_month: string;
  start_date: string | null;
  end_date: string | null;
  status: RetreatStatus;
  ops_owner_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface RetreatWithClient extends Retreat {
  client_name: string;
  ops_owner_name: string | null;
}

export type TransactionSource = "plaid" | "csv" | "manual";

export interface Transaction {
  id: string;
  source: TransactionSource;
  plaid_transaction_id: string | null;
  plaid_account_id: string | null;
  account_label: string | null;
  posted_date: string;
  description: string;
  /** Negative = money out, positive = money in. */
  amount: number;
  raw_plaid_payload: unknown;
  import_batch_id: string | null;
  migration_row_hash: string | null;
  reconciled: boolean;
  reconciled_at: string | null;
  reconciled_by: string | null;
  is_deleted_by_source: boolean;
  created_at: string;
  updated_at: string;
}

export interface TransactionCoding {
  transaction_id: string;
  category_id: string;
  retreat_id: string | null;
  comment: string | null;
  coded_by: string;
  coded_at: string;
  updated_by: string | null;
  updated_at: string;
}

/** A transaction joined with its (possibly absent) coding, for list views. */
export interface TransactionWithCoding extends Transaction {
  coding: TransactionCoding | null;
  category: Category | null;
  retreat: RetreatWithClient | null;
}

export interface RetreatLock {
  id: string;
  retreat_id: string;
  locked_by: string;
  locked_at: string;
  unlocked_by: string | null;
  unlocked_at: string | null;
}

export interface AuditLogEntry {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  before: unknown;
  after: unknown;
  metadata: unknown;
  created_at: string;
}

export type PlaidItemStatus = "active" | "error" | "disconnected";

export interface CategoryRule {
  id: string;
  keyword: string;
  category_id: string;
  priority: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

/** access_token_* is intentionally omitted — never surfaced past lib/plaid/. */
export interface PlaidItem {
  id: string;
  institution_name: string | null;
  institution_id: string | null;
  item_id: string;
  cursor: string | null;
  status: PlaidItemStatus;
  last_sync_at: string | null;
  last_sync_error: string | null;
  connected_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlaidAccount {
  id: string;
  plaid_item_id: string;
  plaid_account_id: string;
  name: string;
  mask: string | null;
  subtype: string | null;
  is_active: boolean;
  created_at: string;
}

export type ImportSource = "csv" | "excel_migration" | "plaid_backfill";

export interface ImportBatch {
  id: string;
  source: ImportSource;
  file_name: string | null;
  imported_by: string | null;
  row_count: number | null;
  notes: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Computed / report types — never persisted as-is.
// ---------------------------------------------------------------------------

export interface RetreatActuals {
  retreat_id: string;
  client_id: string;
  retreat_month: string;
  revenue: number;
  cogs: number;
  flight_cogs: number;
}

/** RetreatActuals with derived fields, including both AllFly views. */
export interface RetreatSummary extends RetreatActuals {
  gross_profit: number;
  margin: number | null;
  cogs_ex_flights: number;
  gross_profit_ex_flights: number;
  margin_ex_flights: number | null;
}

export interface ClientSummary {
  client_id: string;
  client_name: string;
  revenue: number;
  cogs: number;
  gross_profit: number;
  margin: number | null;
  retreat_count: number;
}

export interface MonthlyPnl {
  month: string; // ISO date, first of month
  revenue: number;
  cogs: number;
  overhead: number;
  gross_profit: number;
  net_income: number;
}
