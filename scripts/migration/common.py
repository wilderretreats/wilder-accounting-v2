"""Shared constants and helpers for the historical migration pipeline.

Source: the Google Sheet at
https://docs.google.com/spreadsheets/d/10lED-1N87DpCEX8ZLJkLJfrBAePX7eKnARH6h4u12bs
(~120 tabs). Three distinct raw-data layouts exist in that workbook:

  A. Monthly bank-feed tabs (JAN, FEB, ... DEC for 2026): one header row
     (Account, Date, Description, Amount, Expense Type, Main Category,
     Expense Subcategory, Comment), then one row per transaction.
  B. Legacy per-client tabs (e.g. "Vivun", "Panther", "Shoreline", and some
     2026 retreats that never got a fancier audit tab, e.g. "Earth Species
     Oct 2026"): no header row. A "Revenue" label in column A starts a
     revenue block, an "Expenses" label starts an expense block, each row
     within a block is (Date, Description, Amount, Expense Type, Main
     Category, Expense Subcategory, Comment), and blocks end with a
     numeric-only subtotal row.
  C. The single "2026 Overhead" tab: no header, no sections — straight rows
     of (Date, Description, Amount, "Overhead", [usually blank], [usually
     blank], [usually blank], free-text note). Main Category/Subcategory are
     blank on almost every row here (confirmed by direct inspection), so
     most Overhead rows will migrate as uncategorized and need manual
     re-coding in the app afterward — that's a data-completeness fact about
     the source, not a bug in this script.

There's a fourth category of tab — per-retreat "audit" tabs (e.g. "Panther
Feb 2026", "TowerPoint 2026") — which are DERIVED from A/B (filtered copies
plus Cash Summary / category-rollup formulas), not raw sources. Migrating
from them too would double-count every transaction. 01_extract.py detects
and skips them automatically (see is_audit_tab()), but they ARE used by
2026_reconciliation.py-style checks against the sheet's own summary tabs.
"""

from __future__ import annotations

import re

SKIP_TABS = {"2025 Summary", "2026 Summary", "RETREAT TEMPLATE"}
OVERHEAD_LEDGER_TAB = "2026 Overhead"
MONTH_TAB_NAMES = {
    "JAN", "FEB", "MAR", "APR", "MAY", "JUNE", "JUN", "JULY", "JUL",
    "AUG", "SEP", "OCT", "NOV", "DEC",
}

# Raw (Main Category / Expense Type) text -> canonical category name, built
# from the actual distinct values found across every monthly tab (confirmed
# via direct inspection — see the ~40-variant catalogue this was derived
# from). Lowercased, whitespace-collapsed lookup. Anything not listed here
# is intentionally left unmapped rather than guessed — it'll show up in
# scratch/unmapped_categories.txt for a human to add or resolve by hand.
CATEGORY_MAP: dict[str, str] = {
    # Revenue
    "client payment": "Client Payment",
    "commission": "Commission",
    "comission": "Commission",  # typo seen in source
    "commission & refund": "Commission",
    "allfly commission": "Commission",
    "hotel commission": "Commission",
    "rebate": "Rebate",
    "guest payment": "Refund/Guest Payment",
    "client refund": "Refund/Guest Payment",
    "refund": "Refund/Guest Payment",
    "sale": "Client Payment",  # best-effort; flag for review if it looks wrong
    "client payments": "Client Payment",  # plural variant seen in source

    # COGS
    "lodging": "Lodging",
    "loding": "Lodging",  # typo seen in source
    "flights": "Flights/Airfare",
    "flight": "Flights/Airfare",
    "flights (refund)": "Flights/Airfare",
    "airfare": "Flights/Airfare",
    "activities": "Activities",
    "activity": "Activities",
    "activities (refund)": "Activities",
    "enterainment": "Activities",  # typo of "entertainment" seen in source
    "entertainment": "Activities",
    "transportation": "Transportation",
    "ground transportation": "Transportation",
    "meals": "Meals Off-Site",  # ambiguous (could be Hotel Meals); closest canonical match
    "meal": "Meals Off-Site",
    "staff travel": "Staff Travel",
    "scout": "Site Visit",  # "scouting trip" = site visit
    "site visit": "Site Visit",
    "dmc partner": "DMC/Third-Party DMC",
    "dmc": "DMC/Third-Party DMC",
    "third party dmc": "DMC/Third-Party DMC",
    "dmc payment": "DMC/Third-Party DMC",
    "swag": "SWAG",
    "swag refund": "SWAG",
    "photography": "Photography/Videography",
    "photography/videography": "Photography/Videography",
    "furniture rental": "Rental (Furniture/Plant)",
    "plant rental": "Rental (Furniture/Plant)",
    "a/v": "Meetings & A/V",
    "a/v shipping": "Meetings & A/V",
    "facilitator": "Facilitator",
    "signage": "Signage",
    "decor": "Decor",
}

# Values NOT in CATEGORY_MAP that are known to need a human decision rather
# than a guess (kept here just as documentation of what's been triaged
# already — the script doesn't special-case these, they just fall through
# to "unmapped" like anything else not in CATEGORY_MAP):
#   "Client Amenity", "Materials", "LOE", "LOE Payment", "Return",
#   "Kim bday flowers" (looks like a miscoded personal/overhead expense
#   sitting in a client tab — worth flagging to the user specifically).

EXPENSE_TYPE_MAP = {
    "revenue": "revenue",
    "cogs": "cogs",
    "overhead": "overhead",
    # seen once each in the old sheet as data-entry mistakes; both rows were
    # actually refunds against a COGS line, not a new type:
    "refund": "cogs",
    "client refund": "cogs",
    "travel": "cogs",
    # "Vistage" was a client name that leaked into Expense Type in the old
    # app's schema (see the ground-up-rebuild plan's "lessons learned") —
    # if it shows up here too, treat it the same way: COGS, not a real type.
    "vistage": "cogs",
    "cogs (refund)": "cogs",
    "revvenue": "revenue",  # typo seen in source
    "rebate": "revenue",
    "refund from hotel": "cogs",
    "food & drink": "cogs",
}


def normalize_key(raw: str | None) -> str:
    if raw is None:
        return ""
    return re.sub(r"\s+", " ", str(raw).strip().lower())


def canonical_category(raw_main_category: str | None) -> str | None:
    key = normalize_key(raw_main_category)
    return CATEGORY_MAP.get(key)


def canonical_expense_type(raw_expense_type: str | None) -> str | None:
    key = normalize_key(raw_expense_type)
    return EXPENSE_TYPE_MAP.get(key)


# Client name variants confirmed (by direct inspection of scratch/client_retreat_map.csv
# from a real extraction run) to be the same client, not a different one — only
# unambiguous typo/case/whitespace variants of an identical name go here.
# Deliberately NOT included, because they could be genuinely distinct entities
# and need a human's judgment call instead: "Shoreline" vs "Shoreline Equity
# Partners", "Tier"/"Tier4"/"Tier 4", "Lavi"/"Lavi Industries",
# "Presidio"/"Presidio Legal", "Govini"/"Govini Site"/"Govini Site Visit",
# "Cage Point | Mile Marker" vs "Mile Marker". Review scratch/client_retreat_map.csv
# for these after running 02_category_map.py and extend this dict if confident,
# or plan to merge the resulting duplicate Client rows by hand in the app later.
CLIENT_NAME_ALIASES: dict[str, str] = {
    "echidna giving": "Echidna",
    "instrumentl": "Instrumentl",  # canonicalizes case variants via normalize_key lookup below
    "human traffiking institute": "Human Trafficking Institute",
    "human trafficking institute": "Human Trafficking Institute",
    "ka'chava": "KaChava",
    "kachava": "KaChava",
    "milemarker": "Mile Marker",
    "mile marker": "Mile Marker",
    "native path": "NativePath",
    "nativepath": "NativePath",
    "openmined": "OpenMined",
    "tower point": "TowerPoint",
    "towerpoint": "TowerPoint",
    "legal defense": "Legal Defense Fund",
    "legal defense fund": "Legal Defense Fund",
    "spring street ex": "Spring Street Exchange",
    "spring street exchange": "Spring Street Exchange",
    # Resolved with the user 2026-07-08, from scratch/client_retreat_map.csv:
    "earth species": "Earth Species Project",
    "earth species project": "Earth Species Project",
    "lavi": "Lavi Industries",
    "lavi industries": "Lavi Industries",
    "tier": "Tier 4",
    "tier4": "Tier 4",
    "tier 4": "Tier 4",
    "govini": "Govini",
    "govini site": "Govini",
    "govini site visit": "Govini",
    "shoreline": "Shoreline Equity Partners",
    "shoreline equity": "Shoreline Equity Partners",
    "shoreline equity partners": "Shoreline Equity Partners",
    # Cage Point and Mile Marker merged as companies; user asked to use the
    # more recent name (Mile Marker) for all historical records.
    "cage point | mile marker": "Mile Marker",
    "cage point": "Mile Marker",
    "ldf": "Legal Defense Fund",
    "presidio": "Presidio Legal",
    "presidio legal": "Presidio Legal",
}


def canonical_client_name(raw_client_name: str) -> str:
    key = normalize_key(raw_client_name)
    return CLIENT_NAME_ALIASES.get(key, raw_client_name.strip())


# Matches "FMX 1", "FMX 2" -> base client "FMX". Deliberately does NOT strip
# trailing numerals in general text cleanup elsewhere — they're a meaningful
# retreat-instance disambiguator, not noise.
RETREAT_NUMERAL_SUFFIX = re.compile(r"^(.*?)\s+(\d+)$")


def split_client_and_retreat_name(raw_name: str) -> tuple[str, str]:
    """('FMX 1') -> ('FMX', 'FMX 1'); ('Spot Hero') -> ('Spot Hero', 'Spot Hero')."""
    name = re.sub(r"\s+", " ", raw_name.strip())
    m = RETREAT_NUMERAL_SUFFIX.match(name)
    if m:
        return m.group(1).strip(), name
    return name, name


def looks_like_multiple_clients(raw_subcategory: str) -> bool:
    """Flags rows like 'Artisight & Presidio' or 'Govini & Presidio & Artisight' —
    a shared/split charge across clients, which v1 doesn't support auto-migrating
    (matches the confirmed no-splitting decision). These go to a manual-review
    bucket instead of being silently assigned to one client."""
    return bool(re.search(r"\s(&|and|,|/)\s", raw_subcategory, re.IGNORECASE))
