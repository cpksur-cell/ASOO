# 08 — Security & Authorization

## 1. Threat model

What this system actually protects:

| Asset | Threat | Consequence |
|---|---|---|
| Member PII (national IDs, license scans) | Unauthorized read, bulk export | Identity theft; regulatory breach by a government-affiliated body |
| Financial records | Tampering, fabricated payment confirmation | Revenue loss; audit failure |
| Certificates | Forgery | A fake surveyor obtains work using a fabricated good-standing letter |
| Member directory | Enumeration and scraping | Mass harvesting of professionals' contact details |
| Admin capability | Privilege escalation | Complete compromise |
| Public content | Defacement | Reputational damage to an official body |

Two consequences shape the design: **an invoice reference or certificate code must not be enumerable**, and **every admin action must be attributable**.

---

## 2. Authentication

Firebase Authentication.

| Method | Who |
|---|---|
| Email + password | Members and staff |
| Phone / SMS OTP | Members — many Jordanian professionals use phone as primary identity |
| Google | Optional convenience for Workspace-domain staff |

- Minimum password length **12 characters**, checked against a breached-password list. No composition rules — length beats character-class theatre.
- **MFA is required for every staff role.** Not optional. A `content_editor` account is a route to defacement; a `finance_officer` account is a route to money.
- Sessions are HTTP-only, `Secure`, `SameSite=Lax` cookies. Idle timeout: **30 days** for members, **8 hours** for staff.
- Failed login: exponential backoff by IP and by account. Lockout notifies the account owner.
- Password reset tokens are single-use and expire in 60 minutes.

---

## 3. Authorization — three independent layers

```
Request
  │
  ├─► [1] Middleware      route access by role claim
  │        fail → redirect to login or 403
  │
  ├─► [2] Server action   operation-level permission check
  │        fail → throw before touching the database
  │
  └─► [3] Data Connect    @auth predicate, row-level ownership
           fail → returns nothing, even if called directly
```

No layer is trusted alone. A member requesting another member's invoice fails at layer 3 even if 1 and 2 were somehow bypassed. Adding a route without a layer-3 predicate is a defect regardless of what layers 1 and 2 do.

Roles are Firebase Auth **custom claims** for cheap edge gating and are **mirrored into Postgres** so permissions are joinable in queries and reports. Both are written by a single server-side function in one operation — they cannot diverge because nothing writes one without the other.

---

## 4. Permission matrix

`✓` = allowed · `own` = only their own records · `—` = denied

| Resource : action | super_admin | membership_officer | finance_officer | content_editor | support_agent | member | public |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| **Members** |
| `members:read` | ✓ | ✓ | ✓ | — | ✓ | own | public fields only |
| `members:create` | ✓ | ✓ | — | — | — | — | — |
| `members:update` | ✓ | ✓ | — | — | — | own profile | — |
| `members:suspend` | ✓ | ✓ | — | — | — | — | — |
| `members:export` | ✓ | ✓ | — | — | — | — | — |
| `applications:read` | ✓ | ✓ | — | — | — | own | — |
| `applications:review` | ✓ | ✓ | — | — | — | — | — |
| `renewals:read` | ✓ | ✓ | ✓ | — | — | own | — |
| `renewals:review` | ✓ | ✓ | — | — | — | — | — |
| **Finance** |
| `feeplans:read` | ✓ | ✓ | ✓ | — | — | — | — |
| `feeplans:manage` | ✓ | — | ✓ | — | — | — | — |
| `invoices:read` | ✓ | ✓ | ✓ | — | — | own | by reference only |
| `invoices:issue` | ✓ | — | ✓ | — | — | — | — |
| `invoices:bulk_issue` | ✓ | — | ✓ | — | — | — | — |
| `invoices:waive` | ✓ | — | ✓ | — | — | — | — |
| `payments:read` | ✓ | — | ✓ | — | — | own | — |
| `payments:record_manual` | ✓ | — | ✓ | — | — | — | — |
| `payments:refund` | ✓ | — | ✓ | — | — | — | — |
| `reports:financial` | ✓ | — | ✓ | — | — | — | — |
| **Content** |
| `posts:read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | published only |
| `posts:write` | ✓ | — | — | ✓ | — | — | — |
| `posts:publish` | ✓ | — | — | ✓ | — | — | — |
| `pages:write` | ✓ | — | — | ✓ | — | — | — |
| `documents:write` | ✓ | — | — | ✓ | — | — | — |
| `links:manage` | ✓ | — | — | ✓ | — | — | — |
| `media:upload` | ✓ | ✓ | — | ✓ | ✓ | — | — |
| `layout:manage` | ✓ | — | — | ✓ | — | — | — |
| **Services** |
| `certificates:request` | — | — | — | — | — | own | — |
| `certificates:issue` | ✓ | ✓ | — | — | — | — | — |
| `certificates:revoke` | ✓ | ✓ | — | — | — | — | — |
| `certificates:verify` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | by code only |
| `complaints:read` | ✓ | ✓ | — | — | ✓ | own | by token |
| `complaints:manage` | ✓ | ✓ | — | — | ✓ | — | — |
| **Communication** |
| `notifications:templates` | ✓ | — | — | ✓ | — | — | — |
| `notifications:campaign` | ✓ | ✓ | ✓ | ✓ | — | — | — |
| **System** |
| `roles:manage` | ✓ | — | — | — | — | — | — |
| `users:manage` | ✓ | — | — | — | — | — | — |
| `settings:manage` | ✓ | — | — | — | — | — | — |
| `audit:read` | ✓ | — | — | — | — | — | — |

**This table is the specification.** Implementation is checked against it. Any permission needed that is not listed requires the table to be updated first.

Notable deliberate choices:
- `certificates:issue` sits with membership, not finance — issuing a good-standing certificate is a membership judgment.
- Only `super_admin` reads the audit log. An officer who can read the audit log can see what they need to avoid.
- `invoices:waive` is finance-only and always requires a reason.
- `members:export` is restricted and separately audited — bulk export is the highest-value target in the system.

---

## 5. Data Connect authorization

Every operation declares an `@auth` level. **Nothing is public by default.**

```graphql
# Public — published content only
query PublishedPosts($locale: Locale!) @auth(level: PUBLIC) { ... }

# Public directory — active + consented members only, public fields only
query DirectorySearch($q: String!) @auth(level: PUBLIC) { ... }

# Member-scoped — bound to auth.uid so cross-member reads are impossible
query MyInvoices @auth(level: USER) {
  invoices(where: { member: { user: { id: { eq_expr: "auth.uid" } } } }) { ... }
}

# Staff — role claim required
mutation WaiveInvoice(...) @auth(level: USER, expr: "auth.token.roles.hasAny(['super_admin','finance_officer'])") { ... }
```

The `auth.uid` binding in member queries is what makes layer 3 real. A member cannot read another member's invoices even by calling the operation directly with someone else's ID, because the predicate is applied server-side and cannot be overridden by an argument.

---

## 6. Sensitive data

| Data | Storage | Access |
|---|---|---|
| National ID | `members.national_id`, encrypted at rest | Own record, or `membership_officer` — never in a list view, never in an export without a separate permission |
| License scans, ID copies | **Private** bucket | Short-lived signed URL after a permission check |
| Complaint attachments | **Private** bucket | Parties to the complaint and assigned staff only |
| Issued certificates | **Private** bucket | The member, and the public verify endpoint (metadata only, never the file) |
| Payment credentials | Google Secret Manager | Server runtime only |

**Signed URLs expire in 15 minutes** and are generated per request after authorization. There is no path by which a private object gets a durable public URL.

**Uploads** are validated for MIME type and size, then virus-scanned, and are not marked usable until the scan passes. An uploaded-but-unscanned object is never served.

**Directory consent is explicit.** `is_directory_visible` defaults to `false`. A member's data appears publicly only after they opt in, and the directory contact fields are separate columns from the contact-of-record, so a member can publish an office number without publishing their personal one.

---

## 7. Audit logging

**Every admin mutation writes an `audit_logs` row in the same transaction as the change.** Enforced by a shared mutation wrapper — bypassing the wrapper is a review rejection.

```ts
await withAudit(
  { action: 'invoice.waive', entityType: 'invoice', entityId: id, reason },
  async (tx) => { /* the actual mutation */ }
)
```

If the audit write fails, the transaction rolls back. A change without a record is not an acceptable outcome.

Captured: actor, actor's role **at the time** (a snapshot — roles change, the log must not), action, entity, before/after JSON, reason, IP, user agent, timestamp.

`audit_logs` has no update or delete path in the application, and the database role the application uses holds only `INSERT` on that table.

**Reason is mandatory** for: invoice waiver, invoice cancellation, member suspension, application rejection, renewal rejection, certificate revocation, refund, role change.

---

## 8. Enumeration protection

Three public endpoints accept an identifier and reveal information. All three are protected identically:

| Endpoint | Identifier | Protection |
|---|---|---|
| `/services/pay/[reference]` | Invoice public reference | Random 12+ chars, not sequential; 5 lookups / 15 min / IP |
| `/services/verify/[code]` | Certificate verification code | Random 16+ chars; 20 lookups / 15 min / IP |
| `/join/status/[token]` | Application tracking token | Random 32 chars; 10 lookups / 15 min / IP |

**Never derive a public identifier from a sequential internal ID.** `ASOO-2026-000123` is a human-facing invoice number and is fine on a printed invoice — it is *not* the lookup key. The lookup key is `public_reference`, which is random and unrelated.

The directory is paginated and rate-limited, and returns only consented public fields. Bulk scraping is slowed rather than prevented — a public directory is public by design — but there is no endpoint that returns the full member list in one call.

---

## 9. Application security

- **CSRF** — server actions carry Next.js's built-in protection; the webhook route is exempt by design and protected by signature verification instead.
- **XSS** — React escapes by default. Rich text from the CMS is sanitized server-side with an allow-list before storage **and** before render. `dangerouslySetInnerHTML` appears in exactly one sanitized component and nowhere else.
- **SQL injection** — no raw SQL in application code; the generated Data Connect SDK parameterizes everything.
- **CSP** — strict, nonce-based, no `unsafe-inline`. Reported and monitored.
- **Headers** — HSTS with preload, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, restrictive `Permissions-Policy`.
- **Rate limiting** — on login, password reset, all three public lookup endpoints, directory search, complaint filing, and the contact form.
- **Dependencies** — automated vulnerability scanning; critical advisories patched within 7 days.

---

## 10. Compliance and retention

Jordan's **Personal Data Protection Law No. 24 of 2023** applies. Practical requirements:

- **Lawful basis** stated in the privacy policy for each processing purpose.
- **Data subject rights** — access, correction, and (where the syndicate's regulatory retention duty does not override) erasure. A documented procedure, not an ad-hoc email.
- **Retention:**

| Data | Retained |
|---|---|
| Financial records | 10 years (statutory) |
| Audit logs | 7 years |
| Member records | Duration of membership + 10 years |
| Complaints | 7 years after closure |
| Notification delivery logs | 3 years |
| Rejected applications | 3 years |
| Session and access logs | 90 days |

- **Breach notification** — a documented procedure with named owners and a 72-hour target.
- **Data residency** — see the open item in `docs/02-architecture.md` §7.1. The chosen region and its legal justification must be recorded in the privacy policy.

---

## 10a. Mock authentication — development only

An impersonation endpoint exists to exercise the role-gated screens before
Firebase Auth is wired up. It issues a session for whatever role it is asked
for, so it is guarded by **two independent conditions** that must both hold
(`src/lib/auth/mock.ts`):

1. `NODE_ENV !== 'production'`
2. `ASOO_ENABLE_MOCK_AUTH === 'true'`

A single flag would be one bad `.env` copy away from granting `super_admin` to
an unauthenticated stranger. The `NODE_ENV` condition means a production build
cannot enable it regardless of environment variables.

The guard is re-evaluated in **three** places, not one:

| Place | Behaviour when disabled |
|---|---|
| `POST /api/auth/mock-login` | Returns **404**, not 403 — a probe cannot confirm the route exists |
| `getUserSession()` | Ignores the mock cookie entirely, so a cookie minted on a dev machine grants nothing if replayed at production |
| `SiteHeader` | The role switcher is not rendered at all |

The route also validates the requested role against an allow-list. It
previously accepted any truthy string, which let the client choose its own
authority.

**Verified behaviour** (regression tests for this are listed in §11):

| Request | Mock disabled | Mock enabled |
|---|---|---|
| `POST /api/auth/mock-login {"role":"super_admin"}` | `404` | `200` |
| `POST /api/auth/mock-login {"role":"HACKER"}` | `404` | `400 Unknown role` |
| `GET /ar/admin`, no session | `307 → /ar/login?next=…` | `307 → /ar/login?next=…` |
| `GET /ar/admin`, **forged** `asoo_mock_role=super_admin` cookie | `307 → /ar/login` | n/a |
| `GET /ar/admin` as `member` | — | `307 → /ar/login` |
| `GET /ar/admin` as `super_admin` | — | `200` |

The forged-cookie row is the one that matters: middleware allows it through
because it only checks that *a* session cookie is present, and the layout then
rejects it. That is layers 1 and 2 behaving as intended.

---

## 11. Pre-launch security checklist

- [ ] **Mock auth cannot be enabled**: `/api/auth/mock-login` returns 404 in a production build, and a forged `asoo_mock_role` cookie grants nothing
- [ ] Permission matrix implemented and verified by automated test, one test per row
- [ ] Every Data Connect operation has an explicit `@auth` level — no defaults
- [ ] Member A cannot reach member B's invoices, documents, or certificates by any route
- [ ] MFA enforced on every staff account
- [ ] Rate limits verified on all public lookup endpoints
- [ ] No private bucket object is reachable without a signed URL
- [ ] Audit rows written for every admin mutation — verified by test, not by inspection
- [ ] `audit_logs` has no update or delete path at the application or database-role level
- [ ] Webhook signature verification rejects a tampered payload
- [ ] Secrets absent from the repository, the client bundle, and all log output
- [ ] CSP active with no `unsafe-inline`
- [ ] Dependency scan clean of critical and high advisories
- [ ] Backup restore drill completed and documented
- [ ] Third-party penetration test completed and findings closed
- [ ] Privacy policy published, accurate, and naming the actual data region
