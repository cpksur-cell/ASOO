# 01 — Product Requirements

**Project:** ASOO Portal — نقابة أصحاب المكاتب المساحية في الأردن
**Status:** Phase 0 (foundation). This document is one of two the syndicate signs off on before implementation begins.

---

## 1. Background

The syndicate was established in 1999 (Regulation 105/1999) under the Jordanian Surveyors Syndicate Law 43/1972. It is the legal and professional body for licensed surveyors and surveying-office owners in Jordan. It regulates the surveying sector, enforces technical quality standards, protects the professional rights of its members, and resolves property disputes in cooperation with the Department of Lands and Survey (DLS).

Today the syndicate's web presence is a **static brochure**. It presents information but transacts nothing:

- The member directory search returns zero results — there is no member database
- Every document in the library is marked *"متاح في مقر النقابة"* (available at the syndicate office) — nothing is downloadable
- News is a fixed list that only a developer can change
- Membership fees are collected in person

Members must physically visit the syndicate office in Amman for routine transactions — paying annual subscriptions, renewing membership, obtaining a good-standing certificate. For a member in Aqaba or Ma'an this is a full day lost.

## 2. Problem statement

> Members cannot transact with their syndicate remotely, the public cannot verify a surveyor's license online, and syndicate staff cannot update their own website.

## 3. Goals

| # | Goal | Success measure |
|---|---|---|
| G1 | Members pay subscriptions and bills online | ≥ 70% of annual subscription revenue collected electronically within 12 months of launch |
| G2 | Members complete routine transactions without visiting the office | Renewal, certificate issuance, and complaint filing all fully online |
| G3 | The public can verify a licensed surveyor or office | Searchable directory with per-member public page and QR-verifiable certificates |
| G4 | Syndicate staff control the website without a developer | News, documents, links, pages, **and homepage layout** all editable in the admin dashboard |
| G5 | Every financial and administrative action is auditable | Immutable audit log covering 100% of admin mutations |
| G6 | The portal serves both Arabic and English audiences | Full AR/EN parity on the public site; Arabic-first throughout |

## 4. Non-goals (explicitly out of scope for v1)

- Producing or hosting actual survey maps or GIS layers — the portal **links to** DLS, RJGC, and Amman GIS systems, it does not replicate them
- Replacing DLS transaction systems — no direct integration with the Lands Department's internal workflows
- A mobile app — the portal is responsive web; a native app may be considered post-launch
- Continuing-education course delivery or an LMS
- Online elections for the syndicate board — announcements only in v1

---

## 5. Users and roles

### 5.1 Public visitor (`public`)
A citizen, investor, lawyer, or contractor who needs to check whether a surveyor is licensed, read syndicate news or legislation, reach official map services, **or pay a bill they were given a reference number for**.

Unauthenticated. Never sees member PII beyond what the member has consented to publish in the directory.

### 5.2 Member (`member`)
A licensed surveyor or the owner of a licensed surveying office. Authenticated. Scoped strictly to their own records.

### 5.3 Syndicate staff
| Role | Responsibility |
|---|---|
| `super_admin` | Everything, including role assignment and settings |
| `membership_officer` | Applications, member records, license status, renewals |
| `finance_officer` | Fee plans, invoices, payment reconciliation, financial reports |
| `content_editor` | News, pages, documents, external links, homepage composition |
| `support_agent` | Complaints and support tickets |

Full permission matrix: `docs/08-security.md`.

---

## 6. Functional requirements

### 6.1 Public site

| ID | Requirement | Priority |
|---|---|---|
| PUB-1 | Homepage composed from admin-configurable blocks (hero, stat counters, service grid, link cards, news feed) | Must |
| PUB-2 | News index, category filtering, and individual article pages, in both locales | Must |
| PUB-3 | Documents library — legislation, tariffs, instructions, forms — with **real downloadable files** | Must |
| PUB-4 | Official maps & e-services page: admin-editable link cards to DLS, Amman, MOLA, RJGC portals | Must |
| PUB-5 | Member directory: search by name, license number, or office name; filter by the 12 governorates | Must |
| PUB-6 | Public member page per licensed member, showing only consented fields | Must |
| PUB-7 | **Pay a bill without an account** using an invoice reference number | Must |
| PUB-8 | Certificate verification page: scan/enter a code, see whether the certificate is genuine and current | Must |
| PUB-9 | New membership application form with document upload | Must |
| PUB-10 | About (mission, vision, values), Board, History, Contact | Must |
| PUB-11 | Locale switcher preserving the current page | Must |

### 6.2 Member dashboard

| ID | Requirement | Priority |
|---|---|---|
| MEM-1 | Overview: membership status, next renewal date, outstanding balance, recent activity | Must |
| MEM-2 | View all invoices — issued, due, overdue, paid — with full history | Must |
| MEM-3 | Pay an outstanding invoice online | Must |
| MEM-4 | Download a receipt (PDF) for any settled payment | Must |
| MEM-5 | Edit the public directory listing: office name, governorate, address, phone, email, specializations | Must |
| MEM-6 | Upload and maintain license and identity documents | Must |
| MEM-7 | Submit an annual renewal request; track its approval status | Must |
| MEM-8 | Request official documents: good-standing certificate, membership certificate, no-objection letter | Must |
| MEM-9 | Download issued certificates as PDF with an embedded QR verification code | Must |
| MEM-10 | File a complaint (boundary dispute, technical, professional conduct) with attachments | Must |
| MEM-11 | Track complaint status and exchange messages with syndicate staff | Must |
| MEM-12 | Notification centre — renewal reminders, overdue notices, announcements | Should |

**Gating rule:** a member whose status is `suspended` or `expired` retains read access to their own records and the ability to pay outstanding invoices, but cannot request certificates or appear in the public directory.

### 6.3 Admin dashboard

| ID | Requirement | Priority |
|---|---|---|
| ADM-1 | Membership application queue: review, request more information, approve, reject | Must |
| ADM-2 | Member records: search, filter, edit, change license status (active / suspended / expired / withdrawn) | Must |
| ADM-3 | Fee plans & tariffs: define annual subscription amounts by member category, late penalties, proration | Must |
| ADM-4 | Issue invoices individually or in bulk (e.g. annual run for all active members) | Must |
| ADM-5 | Waive, adjust, or credit an invoice — as an append-only correction, with a mandatory reason | Must |
| ADM-6 | Payment reconciliation: match provider-reported payments to local invoices, flag divergence | Must |
| ADM-7 | Financial reports and CSV/XLSX export | Must |
| ADM-8 | **CMS: news** — create, edit, schedule, publish, unpublish; per-locale content | Must |
| ADM-9 | **CMS: pages** — static page content per locale | Must |
| ADM-10 | **CMS: documents** — upload files, categorize, publish | Must |
| ADM-11 | **CMS: external links** — manage the government service and map link cards | Must |
| ADM-12 | **CMS: homepage composer** — add, remove, reorder, configure, and preview blocks | Must |
| ADM-13 | Certificate requests: review, approve, issue, revoke | Must |
| ADM-14 | Complaints workflow: triage, assign, respond, resolve, close | Must |
| ADM-15 | Notification templates and bulk campaigns to filtered member segments (email + SMS) | Must |
| ADM-16 | Role and permission management; staff user administration | Must |
| ADM-17 | Audit log viewer with filtering by actor, entity, action, and date range | Must |

---

## 7. User stories

### Payments
- *As a member in Aqaba,* I want to pay my annual subscription from my phone so I do not travel to Amman.
- *As a member,* I want to see exactly what I owe and why, broken into line items, before I pay.
- *As a member,* I want an official receipt immediately after paying, so I can file it for tax purposes.
- *As a contractor,* I want to pay a fee I was invoiced for using only the reference number, without creating an account.
- *As a finance officer,* I want every payment matched automatically to its invoice, and any mismatch flagged for me rather than silently absorbed.

### Membership
- *As a prospective member,* I want to apply online and upload my documents, and to see where my application stands.
- *As a member,* I want to renew annually online and know whether my renewal was approved.
- *As a member,* I want to control what the public sees about my office.
- *As a membership officer,* I want to suspend a license and have that immediately remove the member from the public directory.

### Verification & certificates
- *As a citizen hiring a surveyor,* I want to confirm they are actually licensed and in good standing before I pay them.
- *As a member,* I want a good-standing certificate issued in minutes, not on my next office visit.
- *As a bank employee handed a syndicate certificate,* I want to scan its QR code and immediately confirm it is genuine.

### Content
- *As a content editor,* I want to publish a news announcement in Arabic and English without a developer.
- *As a content editor,* I want to change what the homepage shows — add a stat row, reorder the service grid, feature a different news set — and preview it before it goes live.
- *As a content editor,* I want to add a new government service link card when a ministry launches a portal.

### Governance
- *As a super admin,* I want to know who changed what, when, and from where — permanently.
- *As a finance officer,* I want a corrected invoice to leave the original record intact and visible.

---

## 8. Key constraints

| Constraint | Implication |
|---|---|
| Government-affiliated body handling money | Auditability and data integrity outrank development speed |
| Arabic-first, RTL primary | Layout, typography, and iconography designed RTL-first |
| Members skew toward field professionals on mobile | Mobile experience is not a downgrade; it is a co-primary target |
| Jordanian payment expectations | eFAWATEERcom is the culturally expected rail for official fees |
| No Jordan cloud region available | Data residency requires an explicit, documented legal decision |
| Small syndicate IT capacity | The system must be operable by non-developers after handover |

## 9. Assumptions

- The syndicate can obtain eFAWATEERcom biller status through its bank (in progress, non-blocking).
- Member records exist today in some form (spreadsheet, legacy system, or paper) and can be supplied for a one-time import. **Import format and data quality are unknown — treat as a discovery task in Phase 2.**
- The syndicate can supply the actual legal documents, tariff schedules, and forms currently marked "available at the office."
- Fee amounts and member categories will be confirmed by the syndicate's finance committee.

## 10. Open questions

| # | Question | Owner | Blocks |
|---|---|---|---|
| Q1 | Which cloud region is legally acceptable for member data? | Syndicate legal/IT | Provisioning (Phase 1) |
| Q2 | What is the fee structure — amounts, categories, penalties, proration? | Finance committee | Phase 3 |
| Q3 | In what form do existing member records exist? | Membership office | Phase 2 |
| Q4 | Which certificate types require a physical seal or board signature in addition to the digital one? | Syndicate board | Phase 4 |
| Q5 | Is SMS delivery contracted with a Jordanian aggregator, and which? | Syndicate admin | Phase 5 |
| Q6 | What is the official brand identity — logo files, colors, typography? | Syndicate | Phase 1 |

## 11. Traceability

Every requirement above maps to a route in `docs/04-site-architecture.md` and to tables in `docs/03-data-model.md`. A requirement without both is a planning defect and must be raised, not silently dropped.
