# ASOO Portal

**نقابة أصحاب المكاتب المساحية في الأردن** — Syndicate of Surveying Office Owners in Jordan

Official portal: public site, member dashboard, and administrative dashboard, with electronic bill and subscription payment and a CMS that controls the public site's own composition.

**Status: Phase 0 — foundation.** Documentation, database schema, and design tokens only. No application code yet.

---

## Start here

**[CLAUDE.md](CLAUDE.md)** — the operating manual. Read it before touching anything.

| Document | What it answers |
|---|---|
| [01 — PRD](docs/01-prd.md) | What we are building and for whom |
| [02 — Architecture](docs/02-architecture.md) | How the pieces fit together |
| [03 — Data Model](docs/03-data-model.md) | What tables exist and why |
| [04 — Site Architecture](docs/04-site-architecture.md) | What pages exist and how they link |
| [05 — Design System](docs/05-design-system.md) | What it looks like, and the RTL rules |
| [06 — UX Flows](docs/06-ux-flows.md) | How a user actually gets through it |
| [07 — Payments](docs/07-payments.md) | How money moves |
| [08 — Security](docs/08-security.md) | Who is allowed to do what |
| [09 — CMS](docs/09-cms.md) | How staff control the homepage |
| [10 — Roadmap](docs/10-roadmap.md) | What we build when |

## Stack

Next.js (App Router) · TypeScript · Firebase App Hosting · Firebase Data Connect (PostgreSQL) · Firebase Auth · Cloud Storage · Tailwind CSS · shadcn/ui

Arabic-first, bilingual AR/EN, RTL primary.

## Sources of truth

| Thing | File |
|---|---|
| Database schema | `dataconnect/schema/schema.gql` |
| Design tokens | `design/tokens.json` |
| Permission matrix | `docs/08-security.md` §4 |
| Site content seed | `design/content-inventory.md` |

Never edit generated output. Change the source and regenerate.

## Two decisions blocking Phase 1

1. **Cloud region.** There is no Google Cloud region in Jordan, and region is immutable after provisioning. The syndicate's legal/IT authority must confirm an acceptable region in writing before anything is provisioned. See [architecture §7.1](docs/02-architecture.md).
2. **eFAWATEERcom onboarding.** Bank-mediated, not a self-serve signup, and the longest-lead item in the project. Start it now — the payment abstraction means Phases 1–4 proceed without it, but Phase 5 cannot.

## Commands (available from Phase 1)

```bash
npm run dev
```

```bash
npm run emulators
```

```bash
npm run dc:generate
```

```bash
npm run tokens:build
```
