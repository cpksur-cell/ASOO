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
| Counter e-service requests (`service_requests`) | **Supabase** when configured, else in-memory fallback |
| Audit log (`audit_logs`) | **Supabase** when configured, else in-memory fallback |
| Homepage composition + news articles | **Supabase.** The admin CMS writes the same rows the public pages read — an edit in the composer or news manager appears on the site |
| Member directory / members admin | **Supabase** |
| Documents · external links · the `about` page body | Seed module. No admin screen and no table yet — see below |

The split in the last row is deliberate, not half-finished. The homepage
composer and the news manager are the only CMS screens that exist, so those are
the only tables an editor can currently change. Moving documents, external links
and the `about` body into Postgres now would add rows nobody has a screen to
edit — they stay in the seed until the screen that manages them is built.

**Seeding the CMS content:** `node scripts/seed-cms.mjs [--dry-run]` moves the
seed module's categories, articles and homepage blocks into Postgres. It is
idempotent (keyed on slugs, layout code, and a block's type + position) and
never deletes, so a block an editor added is left alone. Run it once per
environment after `0013`.

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
   in ascending order (`0001` → `0014`) and run it, then run `supabase/seed.sql`.

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
| `0011_service_requests.sql` | Counter e-services: `service_requests` (electronic plate · unarchived change statement, keyed on the DLS key) and the append-only `service_request_events` history, RLS on with no anon policy |
| `0012_permanent_records.sql` | Service requests and reviewed submissions are **permanent records**. `service_request_events` and `report_reviews` each had `ON DELETE CASCADE` *and* an append-only delete rule — a contradiction that made the parent undeletable behind an opaque 500. Both FKs become `ON DELETE RESTRICT`, both append-only rules stay, and `search_path` is pinned on the six helper functions that lacked it |
| `0013_cms_content.sql` | Closes two gaps that kept the CMS off the public site: `posts.featured_image_url` (the uuid FK cannot hold a repository path) and the `badge_text` / `secondary_cta_label` / `view_all_label` columns the hero block actually uses, plus indexes for the homepage and news read paths |
| `0014_atomic_audit.sql` | `audited_write(p_audit, p_ops)` — applies an ordered list of writes AND the audit row in one transaction, closing the gap where a mutation could commit and its record fail. Tables are allowlisted, every column is checked against the catalog, and values are bound through `jsonb_populate_record` rather than interpolated |
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

## 4b. Google sign-in (OAuth)

The code is complete; the provider needs configuring once in two dashboards.
Until that is done the button appears and fails — so do this before announcing
it.

**1. Google Cloud console** → *APIs & Services → Credentials → Create OAuth
client ID → Web application*:

- **Authorised JavaScript origins:** `https://www.asoojo.com`
  (add `http://localhost:3000` for local work)
- **Authorised redirect URI:** `https://<project-ref>.supabase.co/auth/v1/callback`
  — this is **Supabase's** callback, not ours. Google returns to Supabase,
  Supabase then returns to our `/auth/callback`. Getting these two confused is
  the usual cause of `redirect_uri_mismatch`.

Configure the OAuth consent screen while there: app name, support email, logo,
and the syndicate's domain. External apps need verification before they leave
"testing" mode, which takes days — start it early.

**2. Supabase dashboard** → *Authentication → Providers → Google*: enable it,
paste the client ID and client secret, save.

**3. Supabase dashboard** → *Authentication → URL Configuration*:

- **Site URL:** `https://www.asoojo.com`
- **Redirect URLs:** add `https://www.asoojo.com/auth/callback` and
  `http://localhost:3000/auth/callback`

Anything not on that allow-list is refused by Supabase — which is the
behaviour you want, since it is what stops an attacker redirecting a completed
sign-in to their own site.

**How it flows.** `GoogleSignIn` calls `signInWithOAuth`; Google returns to
Supabase; Supabase redirects to `/auth/callback` with a one-time `code`; that
route exchanges it for a session and sets the cookies. The `next` parameter is
validated as a same-origin absolute path before any redirect, so the callback
cannot be used as an open redirect.

**Roles.** A Google sign-up is an `auth.users` INSERT like any other, so the
`handle_new_auth_user` trigger from `0008` mirrors the row into `public.users`
and grants the default `member` role. No separate path, and therefore no gap:
a Google account gets member privileges and nothing more until staff grant
otherwise.

**Claiming a membership.** Signing in with Google proves control of an email
address, *not* that the person is a licensed surveyor. Linking an account to a
member record still goes through `claim_membership()`. Do not let OAuth imply
membership.

---

## 5. Security posture

- **Service role is server-only.** `src/lib/supabase/server.ts` is guarded by
  `server-only`; importing it into client code is a build error. The service-role
  key bypasses RLS and is the trusted backend identity. All authorization happens
  in the app layer *before* it is used (docs/08-security §3).
- **RLS is deny-by-default.** Even if the anon key leaks or is used from the
  browser, it can read only reference data and *published* content — never
  invoices, PII, report files, unpublished content, or the audit log.
- **The audit trail is atomic.** Admin mutations go through `audited_write`
  (0014), which performs the change and inserts the `audit_logs` row inside one
  transaction. A failure anywhere rolls back everything, so "changed but not
  recorded" is no longer a reachable state. `audit_logs` is deliberately absent
  from that function's table allowlist — the trail cannot be written through
  the same door it protects.
- **Append-only enforced in the database.** `audit_logs` and `report_reviews`
  carry `ON UPDATE/DELETE DO INSTEAD NOTHING` rules, so history cannot be rewritten
  even by a bug in application code.
- **Human numbers from sequences; codes are random.** `order_number` and
  `approval_number` come from Postgres sequences (never a racy `COUNT`), and
  `verification_code` is random — never derived from a sequential id, so approvals
  cannot be enumerated (docs/08-security §8).
- **Permanent records.** `service_requests` and reviewed `report_submissions`
  cannot be deleted: their history tables are append-only and the parent FKs are
  `ON DELETE RESTRICT` (0012). An attempt fails with a named constraint
  violation (`23503`) that says which record blocked it.
- **`search_path` is pinned on every helper function** (0012), so a function
  called by name from inside an RLS policy cannot be shadowed. No application
  role can `CREATE` in `public`, so this is defence in depth rather than a fix
  for a live hole.

### Known advisor warnings, and why they stand

Run `get_advisors` after any schema change. These are expected:

| Warning | Why it stands |
|---|---|
| `rls_enabled_no_policy` on 9 tables | **Deliberate.** RLS on with no policy is deny-by-default — the posture 0006 chose. Anon and authenticated get nothing; the server reaches them with the service role after checking permission in the app layer. |
| `extension_in_public` (`citext`, `pg_trgm`) | Cosmetic. Moving an extension after tables depend on its types is disruptive for no security gain. |
| `handle_new_auth_user` callable via RPC | Not exploitable — it is a trigger function, and calling one directly errors. **Not** revoked on purpose: `EXECUTE` changes on the signup path risk breaking registration for a warning with no exploit behind it. |
| `current_user_role` callable via RPC | Must keep `EXECUTE` for `anon`/`authenticated`: RLS policies that call it are evaluated with the caller's privileges, so revoking it would break `staff_read_*` reads. It only ever returns the caller's *own* role. |
| `claim_membership` callable by `anon` | Returns `null` immediately when `auth.uid()` is null, so an anonymous call does nothing. |
| Leaked-password protection disabled | A dashboard toggle worth enabling: *Authentication → Policies*. |

---

## 6. Next steps (auth)

Real identity moves to **Supabase Auth** next: email/password sign-in, session
cookies via `@supabase/ssr`, and `public.users.id` linked to `auth.users.id`. At
that point mock auth is removed entirely and the RLS policies here grow
member-scoped rules bound to `auth.uid()` so a member can read their own rows
directly. Until then, mock auth is disabled in production (the `NODE_ENV` guard in
`src/lib/auth/mock.ts` is restored) and all privileged access is server-side only.
