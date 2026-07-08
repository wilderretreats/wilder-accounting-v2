# Wilder Retreats Accounting

Internal accounting system: bank/card transactions sync in via Plaid, get coded to a client/retreat and category, and roll up into per-retreat, per-client, and company-wide P&L — replacing the manual Google Sheet workflow.

See [SETUP.md](./SETUP.md) for how to provision Supabase, Plaid, and Vercel and get this running end to end.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind
- Postgres + Auth via Supabase (`supabase/migrations/`)
- Plaid for bank sync (`lib/plaid/`) — sandbox by default
- Hosted on Vercel, with Vercel Cron for scheduled sync

## Local development

```bash
npm install
cp .env.local.example .env.local   # fill in values — see SETUP.md
npm run dev
```

## Project layout

- `app/(auth)/` — login, password reset (no app shell)
- `app/(app)/` — everything behind login (dashboard, transactions, clients, retreats, reports, audit, settings)
- `app/api/` — route handlers; `app/api/plaid/` and `app/api/cron/` are the sync-related ones
- `lib/` — Supabase clients, Plaid client/sync/crypto/webhook-verify, reporting queries, audit logging
- `supabase/migrations/` — schema, run in order against a Supabase project
- `scripts/migration/` — one-time historical data import from the old Google Sheet
