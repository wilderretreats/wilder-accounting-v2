"""Step 2: normalize extracted rows — canonical category type/name, and
client/retreat name resolution. Still no database writes; outputs
scratch/normalized_transactions.json plus human-checkpoint reports.

Usage:
    python 02_category_map.py
"""

from __future__ import annotations

import csv
import json
from collections import Counter
from datetime import date, datetime
from pathlib import Path

from common import (
    canonical_category,
    canonical_client_name,
    canonical_expense_type,
    looks_like_multiple_clients,
    normalize_key,
    split_client_and_retreat_name,
)

SCRATCH_DIR = Path(__file__).parent / "scratch"


def to_first_of_month(iso_date: str | None) -> str | None:
    if not iso_date:
        return None
    d = datetime.fromisoformat(iso_date).date()
    return date(d.year, d.month, 1).isoformat()


def main():
    rows = json.loads((SCRATCH_DIR / "extracted_transactions.json").read_text())

    normalized = []
    unmapped_category_counter: Counter = Counter()
    unmapped_category_sample: dict[str, dict] = {}
    unmapped_expense_type_counter: Counter = Counter()
    missing_comment_dates = []
    client_retreat_pairs: dict[tuple[str, str, str], dict] = {}
    ambiguous_client_rows = []

    for row in rows:
        category_type = canonical_expense_type(row.get("expense_type_raw"))
        if category_type is None:
            unmapped_expense_type_counter[normalize_key(row.get("expense_type_raw")) or "(blank)"] += 1

        is_overhead = category_type == "overhead"
        subcategory_raw = row.get("subcategory_raw")

        if not is_overhead and isinstance(subcategory_raw, str) and looks_like_multiple_clients(subcategory_raw):
            ambiguous_client_rows.append(row)
            continue  # handled entirely out-of-band — see scratch/ambiguous_multi_client_rows.json from step 1

        category_name = canonical_category(row.get("main_category_raw"))
        if category_name is None:
            raw_key = normalize_key(row.get("main_category_raw")) or "(blank)"
            unmapped_category_counter[raw_key] += 1
            if raw_key not in unmapped_category_sample:
                unmapped_category_sample[raw_key] = row

        client_name = retreat_name = None
        if not is_overhead:
            if isinstance(subcategory_raw, str) and subcategory_raw.strip():
                client_name, retreat_name = split_client_and_retreat_name(subcategory_raw)
                client_name = canonical_client_name(client_name)
            # else: left as None, will surface as an unresolvable-client row below

        retreat_month = to_first_of_month(row.get("retreat_month_raw"))
        if not is_overhead and retreat_month is None:
            # No Comment-column date on this row — fall back to the row's own
            # posted month, and flag it: this is exactly the case the old
            # sheet's separate Comment column existed to avoid (expenses for
            # a March retreat posting in January), so a silent fallback here
            # is a real accuracy risk worth a human's eyes.
            retreat_month = to_first_of_month(row.get("posted_date"))
            missing_comment_dates.append({**row, "fallback_retreat_month": retreat_month})

        normalized_row = {
            **row,
            "category_type": category_type,
            "category_name": category_name,
            "client_name": client_name,
            "retreat_name": retreat_name,
            "retreat_month": retreat_month,
        }
        normalized.append(normalized_row)

        if not is_overhead and client_name and retreat_month:
            key = (client_name, retreat_name, retreat_month)
            client_retreat_pairs.setdefault(
                key, {"client_name": client_name, "retreat_name": retreat_name, "retreat_month": retreat_month, "row_count": 0}
            )
            client_retreat_pairs[key]["row_count"] += 1

    (SCRATCH_DIR / "normalized_transactions.json").write_text(json.dumps(normalized, indent=2, default=str))

    with (SCRATCH_DIR / "unmapped_categories.txt").open("w") as f:
        f.write("Raw Main Category values with no entry in common.CATEGORY_MAP.\n")
        f.write("Add them there and re-run this script, or leave as-is to import uncategorized.\n\n")
        for raw_key, count in unmapped_category_counter.most_common():
            sample = unmapped_category_sample[raw_key]
            f.write(f"{count:4d}  {raw_key!r}   e.g. {sample.get('tab')}:{sample.get('row')} "
                    f"{sample.get('description', '')[:60]!r}\n")

    if unmapped_expense_type_counter:
        with (SCRATCH_DIR / "unmapped_expense_types.txt").open("w") as f:
            for raw_key, count in unmapped_expense_type_counter.most_common():
                f.write(f"{count:4d}  {raw_key!r}\n")

    with (SCRATCH_DIR / "missing_comment_dates.csv").open("w", newline="") as f:
        writer = csv.DictWriter(
            f, fieldnames=["tab", "row", "posted_date", "description", "amount", "subcategory_raw", "fallback_retreat_month"]
        )
        writer.writeheader()
        for row in missing_comment_dates:
            writer.writerow({k: row.get(k) for k in writer.fieldnames})

    with (SCRATCH_DIR / "client_retreat_map.csv").open("w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["client_name", "retreat_name", "retreat_month", "row_count"])
        writer.writeheader()
        for entry in sorted(client_retreat_pairs.values(), key=lambda e: (e["client_name"], e["retreat_month"])):
            writer.writerow(entry)

    print(f"Normalized {len(normalized)} rows.")
    print(f"  {len(unmapped_category_counter)} distinct unmapped category values "
          f"({sum(unmapped_category_counter.values())} rows) — see scratch/unmapped_categories.txt.")
    if unmapped_expense_type_counter:
        print(f"  {sum(unmapped_expense_type_counter.values())} rows have an unrecognized Expense Type — "
              f"see scratch/unmapped_expense_types.txt.")
    print(f"  {len(missing_comment_dates)} rows had no retreat-month Comment and fell back to their "
          f"posted-date month — see scratch/missing_comment_dates.csv.")
    print(f"  {len(client_retreat_pairs)} distinct (client, retreat, month) combinations — "
          f"review scratch/client_retreat_map.csv before running 03_load.py. This is the single "
          f"highest-risk step to get wrong silently.")
    print(f"  {len(ambiguous_client_rows)} rows skipped entirely (multi-client — see step 1's "
          f"scratch/ambiguous_multi_client_rows.json; these need manual handling, not migration).")


if __name__ == "__main__":
    main()
