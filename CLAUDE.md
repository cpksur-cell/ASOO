# CLAUDE.md — ASOO Portal

Operating manual for any agent or developer working in this repository. Read this before touching anything.

---

## 1. What this is

**ASOO** = نقابة أصحاب المكاتب المساحية في الأردن — the **Jordan Syndicate of Surveying Office Owners**, established 1999 under Law 43/1972 and Regulation 105/1999.

It is a government-affiliated professional body regulating licensed surveyors and surveying offices in Jordan, working alongside the Department of Lands and Survey (دائرة الأراضي والمساحة). Roughly **450 licensed offices** and **1,200 licensed surveyors**.

This repository is the syndicate's official portal. It has three faces:

| Face | Who | What they do |
|---|---|---|
| **Public site** | Citizens, investors, prospective members | News, legislation library, official maps, member directory, **pay a bill without an account** |
| **Member dashboard** | Licensed surveyors & office owners | Subscriptions & payments, profile & annual renewal, certificates & official letters, complaints |
| **Admin dashboard** | Syndicate staff | Members, finance, CMS (including public homepage layout), roles, notifications, audit |

**This is a government system handling money and personal identity documents.** Correctness, auditability, and accessibility outrank velocity. When in doubt, choose the boring, verifiable option.

---

## 2. Non-negotiables

These are not preferences. Violating any of them is a defect.

1. **Arabic is the default locale.** RTL is the primary layout, not a bolt-on. Every layout decision is made in RTL first and verified in LTR second.
2. **No hardcoded user-facing strings — ever.** Every string goes through the i18n layer from the first commit. A literal Arabic or English string in a component is a bug, including in error messages, `aria-label`s, and toast text.
3. **No payment secret reaches the client.** Gateway credentials, webhook signing keys, and provider endpoints live in **Vercel environment variables** (Google Secret Manager was the Firebase-era plan) and are read only in server code.
4. **Never trust a client-supplied amount.** The server recomputes every charge from the invoice in the database. A price arriving in a request body is treated as untrusted noise.
5. **Every admin mutation writes an audit row, in the same transaction as the change.** Use `withAtomicAudit()` (`src/lib/audit/atomic.ts`), which describes the writes and hands them to the `audited_write` Postgres function. PostgREST runs one RPC call in one transaction, so Postgres — not application ordering — guarantees that the change and its record commit together or not at all. Two consequences worth knowing: `before`/`after` are captured by the database from the rows it actually touched, so the trail records what happened rather than what the code believed; and values the DB generates (`request_number`, `approval_number`, `verification_code`) come back from the call, so a client can never supply them. The older `withAudit()` remains **only** for the no-Supabase fallback, where there is no transaction to join — do not use it on a live path.
6. **Financial tables are append-only.** Corrections are new rows (credit notes, adjustments), never `UPDATE`s over history. Government audit requires the original record to survive.
7. **Money is integer fils.** See §7.
8. **WCAG 2.1 AA is the floor**, not a stretch goal.

---

## 3. Stack contract

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js (App Router)** | Server Components by default. `"use client"` requires a reason you can state in one sentence. |
| Language | **TypeScript, `strict: true`** | `any` requires an inline justification comment. |
| Hosting | **Vercel** | Project `asoo-portal`. Serving on `asoo-portal.vercel.app`. **The `asoojo.com` domain is currently dark — see §12.** (Migrated off Firebase App Hosting.) |
| Database | **Supabase** → **PostgreSQL** | Real SQL. Runnable migrations in `supabase/migrations/`; `dataconnect/schema/schema.gql` kept as the design source of truth. See `docs/11-supabase.md`. |
| Auth | **Supabase Auth**, live | Email/password via `@supabase/ssr`; Google OAuth is coded but needs configuring in two dashboards (docs/11 §4b). Roles live in `user_roles` and are re-read per request, never from a JWT claim, so a revoked role cannot survive in a stale token. Mock auth still exists for local dev and is double-gated off in production. |
| Files | **Supabase Storage** | Private bucket for PII. Signed URLs only. |
| Secrets | **Vercel env vars / `.env.local`** | Never `.env` in git. Service-role key server-only. |
| Styling | **Tailwind CSS** + **shadcn/ui** | Tokens drive the Tailwind theme — see §6. |
| Validation | **Zod** | One schema per boundary; parse at the edge, trust inside. |
| Domain/email | **Google Workspace** on `asoojo.com`, registrar Namecheap | The domain points at Vercel, not App Hosting. **Currently suspended — mail is down too.** See §12. |

**Do not add a dependency** that duplicates something in this table without saying why in the PR description.

---

## 4. Directory conventions

```
app/
  [locale]/
    (public)/          # marketing + public services, no auth
    (member)/          # /dashboard/* — requires auth + member role
    (admin)/           # /admin/*     — requires staff role
  api/
    webhooks/          # payment provider callbacks — server only
components/
  ui/                  # shadcn primitives, unmodified where possible
  features/            # ASOO-specific composites (InvoiceCard, BlockRenderer, ...)
  blocks/              # CMS block renderers, one file per block type
lib/
  auth/                # session, role resolution, permission checks
  supabase/            # clients: server (service role, server-only), browser, config
  data/                # THE data boundary — see §5
    index.ts           #   getRepository(): Supabase when configured, else seed
    *-source.ts        #   public reads  (cms, members, reports, service-requests)
    *-admin.ts         #   admin writes  (cms-admin, admin-members)
    seed.ts            #   in-memory content, still backing what has no table yet
  payments/            # provider interface, mock + eFAWATEERcom (not yet wired to invoices)
  audit/               # the mutation wrapper
i18n/                  # NOT under lib/ — locale config, dictionaries, formatters
messages/
  ar.json  en.json     # translation dictionaries
supabase/
  migrations/          # THE runnable database definition, applied in order
  seed.sql             # roles, governorates, categories, demo rows
dataconnect/
  schema/schema.gql    # design reference only — not executed, generates nothing
design/
  tokens.json          # SOURCE OF TRUTH for design tokens
docs/                  # architecture, PRD, IA, design system, etc.
```

**Naming**

| Thing | Convention | Example |
|---|---|---|
| Postgres tables & columns | `snake_case`, tables plural | `member_documents`, `issued_at` |
| TypeScript | `camelCase`, types `PascalCase` | `invoiceTotal`, `type MemberStatus` |
| Routes & files | `kebab-case` | `app/[locale]/(member)/dashboard/subscriptions/page.tsx` |
| Slugs | ASCII, transliterated from Arabic | `ijtimaa-alhaya-alamma-2025` |
| Env vars | `SCREAMING_SNAKE` | `PAYMENT_PROVIDER` |

Arabic titles never become URL slugs directly. Transliterate, or use an admin-set English slug field.

---

## 5. Data access rules

There is no Data Connect and no generated SDK. Data access is **supabase-js
behind a source module** — `src/lib/data/*-source.ts` for reads the public site
makes, `*-admin.ts` for admin writes. Page components never call supabase-js
directly; they go through `getRepository()` or a named source function.

- **No client-side database access.** The browser talks to server components,
  server actions, and route handlers. It never holds a database connection.
- **The service-role client is server-only.** `src/lib/supabase/server.ts` is
  guarded by `server-only`; importing it into client code is a build error. It
  bypasses RLS, so **authorization happens in the app layer before it is used** —
  permission check, then ownership check, then query.
- **RLS is the safety net, not the gate.** Policies are deny-by-default so a
  leaked anon key reads nothing but reference data and published content. That
  is a backstop for a bug in the app layer, not a substitute for the check.
- **Schema change protocol:**
  1. Write a new numbered file in `supabase/migrations/` — never edit an applied one
  2. Read it back before running it; a human reads the SQL
  3. Apply it, then **verify the outcome by querying**, not by trusting success
  4. Add the row to the migration map in `docs/11-supabase.md`
- `dataconnect/schema/schema.gql` is kept as the **design** source of truth for
  tables not yet built. It is not executed and does not generate anything.

---

## 6. Design tokens

`design/tokens.json` is the single source of truth. It generates CSS custom properties and the Tailwind theme extension.

- **Never write a raw hex value in a component.** Use a semantic token (`text-muted`, `bg-surface-raised`, `border-status-overdue`).
- **Never write a raw pixel value for spacing.** Use the scale.
- Token layers: **primitive** (raw ramps) → **semantic** (`surface.raised`, `status.overdue`) → **component**. Components consume the semantic layer, not the primitive layer.

---

## 7. Money

- Stored as **integer fils**. 1 JOD = 1000 fils. `12.500 JOD` is `12500`.
- **Never** `float` or `double` for an amount, anywhere — not in TypeScript, not in Postgres, not in JSON payloads.
- Currency code is always explicit: `JOD`. Display with **3 decimal places** (Jordanian convention), e.g. `12.500 د.أ`.
- Formatting lives in `src/i18n/format.ts`. Do not format money inline in a component.
- **Digits:** financial figures, license numbers, invoice numbers, and national IDs always render in **Western digits (0-9)** in both locales, to eliminate transcription errors. Eastern Arabic digits (٠-٩) are permitted only in decorative or editorial contexts.

---

## 8. Dates and time

- **Store UTC.** Always. `timestamptz` in Postgres.
- **Display in `Asia/Amman`.** Never rely on the server's local timezone.
- Gregorian is primary. Where the syndicate uses Hijri (official announcements, some legal documents), display **both**: `١٥ رجب ١٤٤٧ / 2026-01-15`.
- Date formatting lives in `src/i18n/format.ts` alongside money.

---

## 9. Internationalization

- Locales: `ar` (default) and `en`. All routes are locale-prefixed: `/ar/...`, `/en/...`.
- `<html lang>` and `<html dir>` are set per locale. Any subtree containing the other script sets its own `lang`/`dir`.
- **CSS uses logical properties only** — `margin-inline-start`, `padding-inline-end`, `inset-inline-start`. `margin-left` in a stylesheet is a bug.
- **Icon mirroring:** icons encoding *direction* (arrows, chevrons, back/forward, progress) mirror in RTL. Icons encoding *objects* (calendar, document, map pin, user) do not. The full inventory is in `docs/05-design-system.md`.
- Charts, timelines, and step indicators flow right-to-left in Arabic.
- Content translations live in the database (`*_translations` tables), UI strings live in `messages/*.json`. Do not mix the two.

---

## 10. Security posture

- **Defense in depth, three independent checks:** Next.js middleware gates the route → the server component and the server action each re-check the specific permission → RLS backstops at the data layer. A gap in any one layer must not be exploitable. Note the asymmetry: the app talks to Postgres with the service role, which bypasses RLS, so **the app-layer check is the real gate** and RLS only catches what leaks around it.
- **Roles:** `super_admin`, `content_editor`, `finance_officer`, `membership_officer`, `support_agent`, `member`, `public`. The full permission matrix is in `docs/08-security.md` and is the spec implementations are checked against.
- **PII** — national IDs, license scans, ID documents — lives in a **private** Storage bucket and is served only through short-lived signed URLs. Never a public URL, never an unauthenticated path.
- **Webhooks** verify the provider signature before any parsing, persist the raw payload before any business logic, and are **idempotent** on the provider event ID.
- Never log a full national ID, a token, or a payment credential. Redact at the logger.

---

## 11. Commands

```bash
npm run dev              # Next.js dev server
npm run build            # production build
npm run typecheck
npm run lint
npm run verify           # tokens + contrast + i18n + schema + dls-key + typecheck + lint
npm run tokens:build     # design/tokens.json -> CSS variables + Tailwind theme
npm run audit:i18n       # fails on a hardcoded Arabic string in a component
npm run audit:tokens     # fails on an undefined semantic token
npm run audit:schema     # structural check of the schema
```

Scripts, not npm targets:

```bash
node scripts/import-members.mjs "<roster.xlsx>" [--dry-run]   # bulk member import
node scripts/seed-cms.mjs [--dry-run]                          # seed CMS content into Postgres
```

**`npm run verify` is the gate.** Run it before calling anything done; it is
what catches a hardcoded string or an undefined token before review does.

There is **no `npm run test`** — the project has no test runner. `verify` and
the browser are the whole safety net, which is worth knowing before trusting a
change you have not exercised by hand.

Migrations are applied through the Supabase MCP or by pasting the file from
`supabase/migrations/` into the SQL editor. `0001`–`0011` were applied by
pasting, so Supabase has no migration history for them — reconcile that before
relying on `supabase db push`.

---

## 12. Environments

| Env | Where | Notes |
|---|---|---|
| local | `npm run dev` against the **live Supabase project** | There is no emulator and no separate dev database yet. Local work reads and writes production data — see the warning below. |
| preview | Vercel preview deployments, per push | Same Supabase project as production. |
| production | Vercel project `asoo-portal` | Currently reachable only at `asoo-portal.vercel.app`. |

> **One database, no staging.** Every environment points at the same Supabase
> project, so a local experiment writes production rows. Until a second project
> exists, treat local mutations as production changes: prefer `--dry-run`
> flags, scope destructive SQL by a key you have verified first, and never
> point a seed script at a table you have not just read.

### Domain status — `asoojo.com` is suspended

The registrar replaced the nameservers with its enforcement pair:

```
verify-contact-details.namecheap.com
failed-whois-verification.namecheap.com
```

This is ICANN registrant-contact verification, not an expiry and not a DNS
misconfiguration. **Editing records in Namecheap's DNS panel does nothing** —
that zone is no longer authoritative. The whole zone is gone, so `MX` and `TXT`
are absent too: **inbound Google Workspace mail to `@asoojo.com` is being
rejected, and SPF/DKIM are gone.** The mail outage is usually the more urgent
half.

To restore, in order:

1. Verify the registrant contact from the Namecheap email (resend it from
   *Domain List → asoojo.com → Manage* if it has expired). Nameservers come
   back within minutes to about an hour.
2. Then point the domain at Vercel — `A @ → 76.76.21.21` and
   `CNAME www → cname.vercel-dns.com`. Confirm against
   *Vercel → asoo-portal → Settings → Domains*, which states the records it
   expects; trust those over these.
3. Re-add the Workspace `MX` and `TXT` records, or mail stays broken after the
   site returns. Capture them before changing nameservers wholesale.

While the domain is dark, `siteUrl` in `src/lib/site.ts` still defaults to
`https://www.asoojo.com`, so every canonical, `og:url` and sitemap entry points
at an unreachable host. If the outage runs longer than a day or two, set
`NEXT_PUBLIC_SITE_URL=https://asoo-portal.vercel.app` in Vercel and redeploy,
then set it back afterwards.

Database region: the Supabase project is already provisioned, so the
data-residency question in `docs/02-architecture.md` was settled by default
rather than by decision. Confirm it is acceptable to the syndicate's legal/IT
authority — moving it later means a migration.

---

## 13. Definition of done

A change is not done until all of these hold:

- [ ] `npm run typecheck` and `npm run lint` pass clean
- [ ] Renders correctly in **both** `ar` (RTL) and `en` (LTR)
- [ ] Verified at mobile width — a large share of members will use phones
- [ ] Keyboard-navigable, visible focus, correct `lang`/`dir`, form errors announced
- [ ] No hardcoded strings, no raw hex, no raw spacing values
- [ ] If it touches money: amounts are integer fils, server-recomputed, and the state transition is legal
- [ ] If it is an admin mutation: it goes through `withAtomicAudit()`, and the audit row lands in the same transaction
- [ ] If it changed the schema: the migration was human-reviewed before running

---

## 14. Where to look

| Question | Document |
|---|---|
| What are we building and for whom? | `docs/01-prd.md` |
| How do the pieces fit together? | `docs/02-architecture.md` |
| What tables exist and why? | `docs/03-data-model.md` |
| What pages exist and how do they link? | `docs/04-site-architecture.md` |
| What does it look like? | `docs/05-design-system.md` |
| How does a user actually get through it? | `docs/06-ux-flows.md` |
| How do payments work? | `docs/07-payments.md` |
| Who is allowed to do what? | `docs/08-security.md` |
| How does the CMS control the homepage? | `docs/09-cms.md` |
| What are we building when? | `docs/10-roadmap.md` |
| **How do I connect to the database, and what has been migrated?** | **`docs/11-supabase.md`** — the migration map, the env vars, the storage posture, and the advisor warnings that are expected. Read this before touching data. |

**A caution on 01–10.** They were written in Phase 0 against the Firebase Data
Connect plan, before the move to Supabase and Vercel. Their intent, IA, security
matrix and UX flows still hold and are the specification. Their infrastructure
details do not. Where a doc and this file disagree about *how* something is
built, this file and `docs/11` are current — and the doc is worth correcting
while you are there.
