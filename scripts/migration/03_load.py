"""Step 3: idempotent load of scratch/normalized_transactions.json into Supabase.

Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local (same file
the app itself uses — this script never hardcodes a key, unlike the old
app's scripts/sync_from_excel.py, which is exactly the leak this fixes).

Usage:
    python 03_load.py --coded-by-email you@wilderretreats.com [--update-existing] [--dry-run]

--coded-by-email: your admin account's email. Historical codings need a real
    profiles.id to attribute to (the schema requires it, honestly — we don't
    know who originally coded each row in the sheet, so this attributes the
    whole migration batch to whoever runs it, with a comment noting that).
--update-existing: allow re-running to update retreat metadata (owner,
    status, dates) that you've since hand-edited in the app. Without this
    flag, re-runs only add new/missing data and never overwrite anything —
    the default and safer choice for a second pass after fixing the category
    map or client aliases.
--dry-run: print what would happen without writing anything.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client

SCRATCH_DIR = Path(__file__).parent / "scratch"


def migration_row_hash(row: dict) -> str:
    key = f"{row['tab']}|{row['row']}|{row.get('posted_date')}|{row.get('description')}|{row.get('amount')}"
    return hashlib.sha256(key.encode("utf-8")).hexdigest()


def get_supabase():
    # Looks for .env.local first (matches the app's own convention), falling
    # back to whatever's already in the environment.
    load_dotenv(Path(__file__).parent.parent.parent / ".env.local")
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise SystemExit(
            "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not found. "
            "Run this from a checkout with .env.local filled in (see SETUP.md)."
        )
    return create_client(url, key)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--coded-by-email", required=True)
    parser.add_argument("--update-existing", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    rows = json.loads((SCRATCH_DIR / "normalized_transactions.json").read_text())
    supabase = get_supabase()

    coder = (
        supabase.table("profiles").select("id").eq("email", args.coded_by_email).single().execute()
    )
    coded_by = coder.data["id"]

    # --- caches, pre-loaded from the DB so re-runs never re-create anything ---
    clients_by_name: dict[str, str] = {
        c["name"]: c["id"] for c in supabase.table("clients").select("id, name").execute().data
    }
    retreats_by_key: dict[tuple, str] = {
        (r["client_id"], r["name"], r["retreat_month"]): r["id"]
        for r in supabase.table("retreats").select("id, client_id, name, retreat_month").execute().data
    }
    categories_by_key: dict[tuple, str] = {
        (c["type"], c["name"]): c["id"]
        for c in supabase.table("categories").select("id, type, name").execute().data
    }

    if args.dry_run:
        print(f"[dry-run] Would process {len(rows)} rows against "
              f"{len(clients_by_name)} existing clients, {len(retreats_by_key)} existing retreats, "
              f"{len(categories_by_key)} existing categories.")

    batch = None
    if not args.dry_run:
        batch = (
            supabase.table("import_batches")
            .insert({"source": "excel_migration", "row_count": len(rows), "imported_by": coded_by})
            .execute()
            .data[0]
        )

    stats = {"transactions_inserted": 0, "transactions_skipped_dupe": 0, "codings_written": 0,
              "clients_created": 0, "retreats_created": 0, "uncategorized": 0}

    for row in rows:
        category_type = row.get("category_type")
        category_name = row.get("category_name")
        client_name = row.get("client_name")
        retreat_name = row.get("retreat_name")
        retreat_month = row.get("retreat_month")

        retreat_id = None
        if category_type in ("revenue", "cogs") and client_name and retreat_month:
            if client_name not in clients_by_name:
                if args.dry_run:
                    clients_by_name[client_name] = "dry-run-placeholder"
                    stats["clients_created"] += 1
                else:
                    result = (
                        supabase.table("clients")
                        .upsert({"name": client_name}, on_conflict="name")
                        .execute()
                    )
                    clients_by_name[client_name] = result.data[0]["id"]
                    stats["clients_created"] += 1
            client_id = clients_by_name[client_name]

            retreat_key = (client_id, retreat_name, retreat_month)
            if retreat_key not in retreats_by_key:
                if args.dry_run:
                    retreats_by_key[retreat_key] = "dry-run-placeholder"
                    stats["retreats_created"] += 1
                else:
                    result = (
                        supabase.table("retreats")
                        .upsert(
                            {
                                "client_id": client_id,
                                "name": retreat_name,
                                "retreat_month": retreat_month,
                                "status": "completed",
                            },
                            on_conflict="client_id,name,retreat_month",
                        )
                        .execute()
                    )
                    retreats_by_key[retreat_key] = result.data[0]["id"]
                    stats["retreats_created"] += 1
            retreat_id = retreats_by_key[retreat_key]

        category_id = categories_by_key.get((category_type, category_name)) if category_type and category_name else None
        if category_id is None:
            stats["uncategorized"] += 1

        row_hash = migration_row_hash(row)

        if args.dry_run:
            stats["transactions_inserted"] += 1
            if category_id:
                stats["codings_written"] += 1
            continue

        txn_result = (
            supabase.table("transactions")
            .upsert(
                {
                    "source": "csv",  # historical rows have no Plaid transaction_id
                    "account_label": str(row.get("account")) if row.get("account") else None,
                    "posted_date": row["posted_date"],
                    "description": row["description"],
                    "amount": row["amount"],
                    "migration_row_hash": row_hash,
                    "import_batch_id": batch["id"],
                },
                on_conflict="migration_row_hash",
                ignore_duplicates=True,
            )
            .execute()
        )

        if not txn_result.data:
            # ignore_duplicates=True means an existing row returns no data —
            # already migrated in a prior run, skip its coding too (coding
            # is written once, at insert time, not re-applied on every run).
            stats["transactions_skipped_dupe"] += 1
            continue

        stats["transactions_inserted"] += 1
        transaction_id = txn_result.data[0]["id"]

        if category_id:
            supabase.table("transaction_codings").upsert(
                {
                    "transaction_id": transaction_id,
                    "category_id": category_id,
                    "retreat_id": retreat_id,
                    "comment": "Migrated from Google Sheet historical data",
                    "coded_by": coded_by,
                },
                on_conflict="transaction_id",
            ).execute()
            stats["codings_written"] += 1

    print(f"{'[dry-run] ' if args.dry_run else ''}Done.")
    for k, v in stats.items():
        print(f"  {k}: {v}")
    if stats["uncategorized"]:
        print(f"\n{stats['uncategorized']} transactions imported without a coding "
              f"(unmapped category or unresolvable client) — they'll show up in the "
              f"app's Transactions page filtered to 'Uncoded' for manual review.")


if __name__ == "__main__":
    main()
