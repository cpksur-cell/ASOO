# 11 · Supabase — database setup & connection

The project's database runs on **Supabase (managed PostgreSQL)**. This supersedes
the earlier Firebase Data Connect plan; `dataconnect/schema/schema.gql` is kept as
the **design source of truth**, and the runnable Postgres definition now lives in
`supabase/migrations/`.

The application is written to **degrade gracefully**: with no Supabase credentials
set, every wired call falls back to the in-memory demo store and the site runs
exactly as it does today. The moment the three environment variables below are
present, the same code paths read and write real Postgres — no code change, no
redeploy of source.

---

## 1. What is wired to Supabase right now

| Area | Backend today |
|---|---|
| Orders · report submissions · reviews · approvals | **Supabase** when configured, else in-memory fallback |
| Audit log (`audit_logs`) | **Supabase** when configured, else in-memory fallback |
| Public homepage / news / directory / members admin | Seed repository (Supabase tables exist and are seeded; read path wired in a follow-up) |

The full core schema is migrated and seeded regardless, so the follow-up passes
only swap read paths — the data is already there.

---

## 2. Environment variables

Set these in **`.env.local`** for local dev and in the **Vercel project settings**
for the deployed site. **Never commit them** — `.env.local` is git-ignored, and the
service-role key must never reach the browser bundle.

```bash
# Public — safe to expose to the browser (protected by RLS)
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon public key>

# SECRET — server only. Bypasses RLS. Never expose to the client.
SUPABASE_SERVICE_ROLE_KEY=<service role key>
```

`isSupabaseConfigured()` (in `src/lib/supabase/config.ts`) treats the app as
"connected" only when **`NEXT_PUBLIC_SUPABASE_URL`** and
**`SUPABASE_SERVICE_ROLE_KEY`** are both present. Set both together.

Find all three values in the Supabase dashboard under
**Project Settings → API**.

---

## 3. First-time setup

1. **Create the project** at [supabase.com](https://supabase.com) → *New project*.
   - Pick a strong database password (store it in a password manager).
   - **Region:** choose the closest jurisdiction the syndicate's legal/IT authority
     approves (see CLAUDE.md §12 — this is the same data-residency decision that
     was pending under the old plan; **region is immutable after creation**).
2. **Apply the schema.** Two options:

   **A. Supabase SQL Editor (no tooling):** open each file in `supabase/migrations/`
   in ascending order (`0001` → `0010`) and run it, then run `supabase/seed.sql`.

   **B. Supabase CLI (recommended, repeatable):**
   ```bash
   npx supabase link --project-ref <project-ref>
   npx supabase db push          # applies everything in supabase/migrations/
   # then run the seed once:
   npx supabase db execute --file supabase/seed.sql
   ```
3. **Set the environment variables** (section 2) locally and on Vercel.
4. **Verify.** Load `/ar/dashboard/reports` — the three demo orders now come from
   Postgres. Approve the DWG submission in `/ar/admin/reviews`; the generated
   approval number and verification code are written to `report_approvals`, and an
   `audit_logs` row is written in the same request. Scan/open the QR to hit
   `/ar/services/verify-report/<code>` and confirm it reads back from the DB.

---

## 4. Migration file map

| File | Contents |
|---|---|
| `0001_init.sql` | extensions (citext, pgcrypto, pg_trgm), enums, sequences, `set_updated_at`, `next_order_number`, `next_approval_number`, `generate_verification_code` |
| `0002_identity.sql` | `users`, `roles`, `permissions`, `role_permissions`, `user_roles`, `audit_logs` (append-only rules) |
| `0003_membership.sql` | `governorates`, `member_categories`, `members`, `member_translations`, `member_documents` |
| `0004_cms.sql` | `post_categories`, `media_assets`, `posts`, `post_translations`, `layouts`, `layout_blocks`, `layout_block_translations` |
| `0005_reports.sql` | `orders`, `report_submissions`, `report_reviews` (append-only), `report_approvals` |
| `0006_rls.sql` | Row Level Security: deny-by-default, narrow public reads for reference + published content |
| `0007_member_import.sql` | `license_number` made nullable (DLS issues the real numbers), plus `import_source`/`imported_at` provenance for bulk-loaded rows |
| `0008_auth.sql` | Supabase Auth: trigger mirroring `auth.users` into `public.users`, default `member` grant, `current_user_role()` / `is_staff()`, `auth.uid()`-bound RLS, `claim_membership()` |
| `0009_audit_integrity.sql` | Drops the FK on `audit_logs.actor_user_id` — an audit row is a historical fact and must never be blocked from recording, nor become a retention lock on a user |
| `0010_reports_files.sql` | DXF + GML file types, structured approval columns (DLS reference, basin, plot, survey method, notes), and the PRIVATE `reports` storage bucket |
| `seed.sql` | roles, 12 governorates, categories, demo user/member, demo orders/submissions/approval — mirrors the in-memory demo |

### Storage

One bucket, `reports`, created by `0010`. It is **private** and deliberately has
**no policy for `anon` or `authenticated`**, so those roles cannot read, list or
write to it at all. Every access goes through the server with the service role,
after the application has checked the caller's permission, and downloads are
issued as signed URLs valid for two minutes. Verified: an anonymous client can
neither download a known object path nor enumerate the bucket, and a tampered
signature is rejected with a 400.

Not yet migrated (later passes, per the "core tables first" decision): finance
(`invoices`, `payments`, …), certificates, complaints, notifications. They remain
in `schema.gql` and become new numbered migrations when their UI is built.

---

## 5. Security posture

- **Service role is server-only.** `src/lib/supabase/server.ts` is guarded by
  `server-only`; importing it into client code is a build error. The service-role
  key bypasses RLS and is the trusted backend identity. All authorization happens
  in the app layer *before* it is used (docs/08-security §3).
- **RLS is deny-by-default.** Even if the anon key leaks or is used from the
  browser, it can read only reference data and *published* content — never
  invoices, PII, report files, unpublished content, or the audit log.
- **Append-only enforced in the database.** `audit_logs` and `report_reviews`
  carry `ON UPDATE/DELETE DO INSTEAD NOTHING` rules, so history cannot be rewritten
  even by a bug in application code.
- **Human numbers from sequences; codes are random.** `order_number` and
  `approval_number` come from Postgres sequences (never a racy `COUNT`), and
  `verification_code` is random — never derived from a sequential id, so approvals
  cannot be enumerated (docs/08-security §8).

---

## 6. Next steps (auth)

Real identity moves to **Supabase Auth** next: email/password sign-in, session
cookies via `@supabase/ssr`, and `public.users.id` linked to `auth.users.id`. At
that point mock auth is removed entirely and the RLS policies here grow
member-scoped rules bound to `auth.uid()` so a member can read their own rows
directly. Until then, mock auth is disabled in production (the `NODE_ENV` guard in
`src/lib/auth/mock.ts` is restored) and all privileged access is server-side only.
