"""Orchestrates 01 -> 02, then stops for a manual review before 03 (loading
real data is not something this script does unattended).

Usage:
    python run.py /path/to/workbook.xlsx
"""

from __future__ import annotations

import subprocess
import sys


def main():
    if len(sys.argv) != 2:
        print("Usage: python run.py /path/to/workbook.xlsx")
        sys.exit(1)

    workbook_path = sys.argv[1]

    subprocess.run([sys.executable, "01_extract.py", workbook_path], check=True)
    print()
    subprocess.run([sys.executable, "02_category_map.py"], check=True)

    print(
        "\n--- STOP AND REVIEW ---\n"
        "Before running 03_load.py, look at:\n"
        "  scratch/client_retreat_map.csv        (highest risk — client/retreat name resolution)\n"
        "  scratch/unmapped_categories.txt        (add entries to common.CATEGORY_MAP and re-run 02 if you want fewer uncategorized rows)\n"
        "  scratch/ambiguous_multi_client_rows.json  (shared charges across clients — not migrated automatically)\n"
        "  scratch/fallback_source_audit_tabs.txt (rows recovered from tabs with no other source — spot-check these)\n"
        "  scratch/missing_comment_dates.csv      (rows whose retreat-month was guessed from the posted date)\n\n"
        "Then run:\n"
        "  python 03_load.py --coded-by-email you@wilderretreats.com --dry-run   (preview counts, no writes)\n"
        "  python 03_load.py --coded-by-email you@wilderretreats.com            (actually load)\n"
    )


if __name__ == "__main__":
    main()
