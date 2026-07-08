# Historical data migration

One-time import of 2025–2026 transaction history from the Google Sheet
(`https://docs.google.com/spreadsheets/d/10lED-1N87DpCEX8ZLJkLJfrBAePX7eKnARH6h4u12bs`)
into this app's Supabase database. Run this **after** the app is deployed and
migrations 001–010 are applied — it targets the live schema.

## What this actually does (read before running)

The workbook has ~120 tabs in three different raw layouts, plus ~70+ derived
"audit" tabs (per-retreat rollups with a Cash Summary section) that are
filtered copies of the raw data, not a source themselves. `01_extract.py`
detects and skips those — **except** when a retreat has no raw-tab data at
all (confirmed case: several October/November 2026 retreats, where that
month's shared bank-feed tab was simply never populated) — for those, the
audit tab IS the only copy of the data and gets pulled in as a fallback,
tagged `"fallback_source": true`.

This was validated against a real download of the sheet during development:
extraction recovered 2,270 rows from 116 tabs (544 of them via the fallback
path), category mapping resolved ~85% of rows to a canonical category
automatically, and client-name deduping merged 14 pairs of typo/case
variants (`Ka'Chava` / `Kachava` / `KaChava`, etc.) — but **the specific
workbook state changes over time**; re-download it fresh before running this
for real, and treat the numbers above as "this pipeline works," not "these
exact numbers still apply."

**`03_load.py` (the actual database write) was not executed against a live
Supabase project** — there wasn't one to test against while building this.
Its logic was written and reviewed carefully (idempotent upserts, dedup via
content hash, no destructive operations), but run `--dry-run` first and
sanity-check the printed counts before running it for real.

## Steps

```bash
pip install -r requirements.txt

# 1. Download the Google Sheet: File -> Download -> Microsoft Excel (.xlsx)

# 2. Extract + normalize (read-only, no DB writes)
python run.py /path/to/downloaded-workbook.xlsx

# 3. Review the scratch/ files it prints out — especially client_retreat_map.csv.
#    Add entries to common.py's CATEGORY_MAP / CLIENT_NAME_ALIASES and re-run
#    01/02 if you want to resolve more rows automatically before loading.

# 4. Preview the load (no writes):
python 03_load.py --coded-by-email you@wilderretreats.com --dry-run

# 5. Actually load:
python 03_load.py --coded-by-email you@wilderretreats.com

# 6. Sanity-check migrated totals against the sheet's own summary tabs:
python 04_reconcile_check.py /path/to/downloaded-workbook.xlsx
```

Re-running `01`/`02` is always safe (read-only). Re-running `03_load.py` is
safe too by default — it skips anything already loaded (matched by a content
hash of tab+row+date+description+amount) and never overwrites a retreat
you've since edited in the app, unless you pass `--update-existing`.

## Known data-quality facts about the source (not bugs in this script)

- Most historical **Overhead** transactions have blank Main Category/Subcategory
  in the sheet — they'll import as `Overhead` type with no category, and need
  manual re-coding in the app. This reflects how they were actually coded
  (or rather, not coded) in the sheet.
- A handful of rows have a subcategory naming multiple clients (e.g. "Artisight
  & Presidio" — a shared charge). These are excluded from the automatic load
  entirely (see `scratch/ambiguous_multi_client_rows.json`) since v1 has no
  transaction splitting — code them manually in the app after import.
- Client naming is inconsistent across tabs beyond what `CLIENT_NAME_ALIASES`
  catches (e.g. `Shoreline` vs `Shoreline Equity Partners`, `Tier` vs `Tier 4`)
  — these could be genuinely different entities or the same one spelled
  differently; `client_retreat_map.csv` is exactly where to catch this before
  loading, or plan to merge duplicate Client records in the app afterward.
