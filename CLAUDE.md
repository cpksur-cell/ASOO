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
3. **No payment secret reaches the client.** Gateway credentials, webhook signing keys, and provider endpoints live in Google Secret Manager and are read only in server code.
4. **Never trust a client-supplied amount.** The server recomputes every charge from the invoice in the database. A price arriving in a request body is treated as untrusted noise.
5. **Every admin mutation writes an audit row in the same transaction as the change.** No exceptions. Enforced by the shared mutation wrapper — do not bypass it.
6. **Financial tables are append-only.** Corrections are new rows (credit notes, adjustments), never `UPDATE`s over history. Government audit requires the original record to survive.
7. **Money is integer fils.** See §7.
8. **WCAG 2.1 AA is the floor**, not a stretch goal.

---

## 3. Stack contract

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js (App Router)** | Server Components by default. `"use client"` requires a reason you can state in one sentence. |
| Language | **TypeScript, `strict: true`** | `any` requires an inline justification comment. |
| Hosting | **Firebase App Hosting** | Google-managed Next.js runtime on Cloud Run. |
| Database | **Firebase Data Connect** → **PostgreSQL** (Cloud SQL) | Real SQL. Schema in `dataconnect/schema/schema.gql`. |
| Auth | **Firebase Authentication** | Roles as custom claims, mirrored in Postgres. |
| Files | **Cloud Storage for Firebase** | Private bucket for PII. Signed URLs only. |
| Secrets | **Google Secret Manager** | Never `.env` in git. |
| Styling | **Tailwind CSS** + **shadcn/ui** | Tokens drive the Tailwind theme — see §6. |
| Validation | **Zod** | One schema per boundary; parse at the edge, trust inside. |
| Domain/email | **Google Workspace** | Production domain maps to App Hosting. |

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
  auth/                # session, claims, permission checks
  db/                  # generated Data Connect SDK + thin wrappers
  payments/            # provider interface + implementations
  i18n/                # locale config, dictionaries, formatters
  audit/               # the mutation wrapper
messages/
  ar.json  en.json     # translation dictionaries
dataconnect/
  schema/schema.gql    # SOURCE OF TRUTH for the database
  connector/*.gql      # queries and mutations
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

- **All reads and writes go through the generated Data Connect SDK.** No raw SQL in application code.
- **No client-side database access.** The browser talks to server components, server actions, and route handlers. It never holds a database connection.
- **Every Data Connect operation declares an `@auth` level.** Nothing is public by default. Member-scoped data binds on `auth.uid` so a member is physically incapable of reading another member's invoices.
- **Schema change protocol:**
  1. Edit `dataconnect/schema/schema.gql`
  2. Regenerate the SDK
  3. Review the generated migration SQL — a human reads it before it runs
  4. Apply to `dev` → `staging` → `prod`, in that order, never skipping
- **Never hand-edit generated files.** They are overwritten. If you need different output, change the schema.

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
- Formatting lives in `lib/i18n/format.ts`. Do not format money inline in a component.
- **Digits:** financial figures, license numbers, invoice numbers, and national IDs always render in **Western digits (0-9)** in both locales, to eliminate transcription errors. Eastern Arabic digits (٠-٩) are permitted only in decorative or editorial contexts.

---

## 8. Dates and time

- **Store UTC.** Always. `timestamptz` in Postgres.
- **Display in `Asia/Amman`.** Never rely on the server's local timezone.
- Gregorian is primary. Where the syndicate uses Hijri (official announcements, some legal documents), display **both**: `١٥ رجب ١٤٤٧ / 2026-01-15`.
- Date formatting lives in `lib/i18n/format.ts` alongside money.

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

- **Defense in depth, three independent checks:** Next.js middleware gates the route → the server action re-checks permission → Data Connect enforces at the data layer. A gap in any one layer must not be exploitable.
- **Roles:** `super_admin`, `content_editor`, `finance_officer`, `membership_officer`, `support_agent`, `member`, `public`. The full permission matrix is in `docs/08-security.md` and is the spec implementations are checked against.
- **PII** — national IDs, license scans, ID documents — lives in a **private** Storage bucket and is served only through short-lived signed URLs. Never a public URL, never an unauthenticated path.
- **Webhooks** verify the provider signature before any parsing, persist the raw payload before any business logic, and are **idempotent** on the provider event ID.
- Never log a full national ID, a token, or a payment credential. Redact at the logger.

---

## 11. Commands

```bash
npm run dev              # Next.js dev server
npm run emulators        # Firebase emulator suite incl. Data Connect + local Postgres
npm run dc:generate      # regenerate the Data Connect typed SDK
npm run dc:migrate       # apply schema migrations to the current environment
npm run tokens:build     # design/tokens.json -> CSS variables + Tailwind theme
npm run typecheck
npm run lint
npm run test
npm run build
```

Local development runs entirely against the emulator suite. **No developer connects to shared `staging` or `prod` data.**

---

## 12. Environments

| Env | Firebase project | Notes |
|---|---|---|
| local | emulator suite | local Postgres, mock payment provider |
| dev | `asoo-dev` | mock payment provider |
| staging | `asoo-staging` | provider sandbox, behind auth, `*.web.app` domain |
| prod | `asoo-prod` | live provider, Workspace domain |

Cloud SQL region: **pending confirmation** from the syndicate's legal/IT authority. Region is immutable after creation — do not provision until this is answered. See `docs/02-architecture.md`.

---

## 13. Definition of done

A change is not done until all of these hold:

- [ ] `npm run typecheck` and `npm run lint` pass clean
- [ ] Renders correctly in **both** `ar` (RTL) and `en` (LTR)
- [ ] Verified at mobile width — a large share of members will use phones
- [ ] Keyboard-navigable, visible focus, correct `lang`/`dir`, form errors announced
- [ ] No hardcoded strings, no raw hex, no raw spacing values
- [ ] If it touches money: amounts are integer fils, server-recomputed, and the state transition is legal
- [ ] If it is an admin mutation: an audit row is written in the same transaction
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
