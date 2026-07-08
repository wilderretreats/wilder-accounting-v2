# Setup Guide

Everything in the app code is done. These are the account-provisioning steps that need a human with dashboard access — I can't do these on your behalf.

## 1. Create a new Supabase project

1. [supabase.com](https://supabase.com) → **New project**. Name it `wilder-accounting`, pick a strong database password, region close to you.
2. Wait ~2 minutes for provisioning.
3. **Project Settings → API** — copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon / public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role / secret key** → `SUPABASE_SERVICE_ROLE_KEY` (server-only, never in client code or committed)

## 2. Run the database migrations

In Supabase → **SQL Editor**, run each file in `supabase/migrations/` **in order** (001 through 010). Each is small and reviewable — worth skimming before running, especially `007_rls_policies.sql` and `009_transaction_reconciliation.sql`.

## 3. Configure environment variables

```bash
cp .env.local.example .env.local
```

Fill in the Supabase values from step 1, plus:

- `PLAID_TOKEN_ENCRYPTION_KEY` — generate with `openssl rand -base64 32`. This encrypts bank access tokens at rest; losing it means re-connecting every bank account, so store it somewhere durable (password manager) in addition to Vercel env vars.
- `CRON_SECRET` — generate with `openssl rand -hex 32`.
- `NEXT_PUBLIC_APP_URL` — `http://localhost:3000` locally; your real Vercel URL in production.

## 4. Get Plaid sandbox credentials

1. [dashboard.plaid.com](https://dashboard.plaid.com) → sign up if you haven't.
2. **Team Settings → Keys** — copy `client_id` and the **Sandbox** secret into `PLAID_CLIENT_ID` / `PLAID_SECRET`. Set `PLAID_ENV=sandbox`.
3. In sandbox, Plaid Link lets you "connect" a fake institution with test credentials (`user_good` / `pass_good`) — no real bank needed to test the full sync flow.
4. **API → Allowed redirect URIs** — add `http://localhost:3000/plaid-oauth` for local testing, and your production URL + `/plaid-oauth` once deployed. This is required or OAuth-based bank connections (most large US banks) will fail.

**Moving to production later** requires: a completed Plaid production access request (they ask about your use case and data handling — mention this is an internal accounting tool, not a consumer-facing app), a live bank account connected during their review, and swapping `PLAID_ENV=production` with production keys. Budget a few business days for Plaid's review. Don't do this until you're ready to connect real bank accounts — sandbox is free and unlimited for continued development.

## 5. Create your admin account

1. Supabase → **Authentication → Users → Add user** (or invite yourself via email).
2. **SQL Editor**, run:
   ```sql
   update profiles set role = 'admin' where id = (
     select id from auth.users where email = 'you@wilderretreats.com'
   );
   ```

## 6. Run locally

```bash
npm install
npm run dev
```

Log in, connect a Plaid **sandbox** institution under Settings → Bank Connections, confirm transactions sync in as uncoded.

## 7. Deploy to Vercel

1. Push this repo to GitHub (a new repo — see the note in the handoff message about not reusing the old one).
2. [vercel.com](https://vercel.com) → **New Project** → import the repo.
3. Add all the same env vars from `.env.local` (Project Settings → Environment Variables). Use a **different** `PLAID_TOKEN_ENCRYPTION_KEY` and `CRON_SECRET` than local if you generated separate ones — or reuse the same values, just don't let them leak into git either way.
4. Deploy. The `vercel.json` cron schedule (every 4 hours) activates automatically.
5. In Plaid dashboard, add `https://<your-vercel-url>/plaid-oauth` to Allowed redirect URIs, and set the **webhook URL** (Plaid dashboard → your Link token config, or set programmatically) to `https://<your-vercel-url>/api/plaid/webhook` for near-real-time sync on top of the 4-hour cron.

## 8. Invite your team

Sign in as admin → **Settings → Users → Invite user**. Each teammate gets an email to set their password. Everyone can see all clients/transactions in v1 — no per-client restrictions.

## 9. Rotate the old leaked key (do this regardless of the above)

The discarded `wilder-accounting` app's `scripts/sync_from_excel.py` had a live Supabase service-role key hardcoded on disk. If that old Supabase project is still around, rotate its service-role key (Project Settings → API → reset service_role secret) even though you're not using that project anymore — treat any key that touched disk in plaintext as compromised.

## 10. Historical data migration

Once the above is live, see `scripts/migration/README.md` for importing 2025-2026 transaction history from the Google Sheet.
