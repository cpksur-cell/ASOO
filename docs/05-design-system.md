# 05 — Design System

Machine-readable tokens live in `design/tokens.json`. This document explains the reasoning, and specifies everything tokens cannot express.

---

## 1. Direction

**Institutional trust, not startup gloss.**

This is a government-affiliated professional body handling licenses and money. A member checking whether their subscription is overdue, and a citizen checking whether a surveyor is real, both need to believe what they are looking at. Playfulness reads as untrustworthy here; heavy ornament reads as dated.

The visual language borrows from surveying itself: **precise grids, measured spacing, fine hairline rules, cartographic restraint.** Alignment is the primary tool. Color is used sparingly and always means something.

Three rules that follow from this:

1. **Color carries meaning, never decoration.** If a color appears, a user should be able to say what it signifies. The gold accent is reserved for official artifacts — seals, certificates, the est.-1999 badge — and appears nowhere else.
2. **Density over whitespace in the dashboards.** A finance officer reconciling 400 invoices needs information per screen, not generous padding. The public site breathes; the admin dashboard works.
3. **Nothing moves without cause.** Motion confirms an action or reveals structure. There are no decorative animations.

---

## 2. Color

The full ramps are in `design/tokens.json`. The palette is **matched to the syndicate's existing identity**, observed from the live prototype: a forest-green header with a Jordanian-flag-red rule beneath it, repeated under every section heading, over a warm cream page.

**Primary — forest green (`#114E35` at 700).** Taken from the syndicate's existing header and buttons, so the new portal reads as the same institution rather than a rebrand. Dark enough to hold white text at **9.70:1**, which means the primary button, the active nav state, and the footer all work from one tone without a second brand color.

**Rule — Jordanian flag red (`#C8102E`).** The syndicate already uses this as a thin stripe under the header and under each section heading. It is preserved because it is the most recognizable part of their identity.

> ### The red conflict, and how it is resolved
>
> Red is also the **overdue / suspended / revoked** status color. Two different reds carrying two different meanings on the same page is exactly the kind of ambiguity that costs a member money when they miss an overdue notice.
>
> The resolution is a hard constraint, not a convention: **`surface.rule` is decorative only.** It appears exclusively as a 2–3px horizontal rule. It is never a fill, never behind text, never a border on an interactive element, never a badge, never a status.
>
> Status red always appears as a **pill with an icon and a text label**. A 3px horizontal line and a labelled pill are not confusable at any size, in any locale, or by anyone using a screen reader — which is the actual test.
>
> This is enforced in review: `surface.rule` used as anything other than a rule is a rejection.

**Accent — gold/bronze (`#7A550E` at 700).** The color of a seal. Strictly rationed to artifacts that carry legal weight: certificates, official badges, the founding-year mark. Using it as a general highlight would spend its authority.

**Neutrals — warm.** The syndicate's page background is a cream, not a white or a cool gray. The ramp is warmed to match. A cool gray beside this green reads clinical and fights the paper-like quality of the canvas, which for a body that deals in official documents is the wrong association.

**Status colors** are grouped as `{fg, bg, border}` triplets, so a badge is one token lookup rather than three, and no one can accidentally pair a status foreground with the wrong background.

| Status | Meaning in this system |
|---|---|
| `active` (green) | Member active · invoice paid · certificate valid |
| `pending` (blue) | Under review · payment processing · scheduled |
| `warning` (amber) | Due soon · license expiring · action required |
| `overdue` (red) | Overdue · suspended · rejected · revoked |
| `neutral` (gray) | Draft · archived · withdrawn |

> **Never signal status by color alone.** Every status badge carries an icon and a text label. This is a WCAG requirement, and it is also the difference between a member understanding "your membership is at risk" and a member missing it entirely.

**Contrast.** Every foreground/background pairing in the token file records its measured ratio. The build fails if any text pairing drops below **4.5:1** (AA normal text) or any large-text pairing below **3:1**. `text.disabled` is exempt and is documented as non-content only.

---

## 3. Typography

**IBM Plex Sans Arabic** + **IBM Plex Sans** + **IBM Plex Mono**.

One superfamily across both scripts. The Arabic and Latin cuts share a skeleton, weight distribution, and x-height relationship, so an Arabic page and its English translation feel like the same product rather than two separate sites. Plex is also open-licensed, self-hostable — no third-party font CDN on a government site — and has a genuinely good Arabic cut, which most Latin-first superfamilies do not.

Mono is used for **invoice numbers, license numbers, verification codes, and monetary amounts in tables** — anything a human might transcribe. Tabular figures make columns of money align, and a distinguishable `0`/`O` and `1`/`l` prevents transcription errors on exactly the values where errors cost money.

### 3.1 The Arabic size rule

**Arabic renders at ~8–12% larger than Latin at the same nominal step.** This is not a preference. Arabic letterforms carry more detail in connecting strokes and below the baseline; set at Latin-equivalent pixel sizes, Arabic reads smaller and thinner than it is. The token file therefore carries **two size scales**, `fontSize` and `fontSizeArabic`, selected by locale — not one shared scale with a fudge factor.

Line height follows the same logic: Arabic needs **1.75** where Latin is comfortable at **1.5**. Diacritics and descenders collide at Latin-typical leading.

### 3.2 Type scale in use

| Role | Latin | Arabic | Weight | Line height |
|---|---|---|---|---|
| Display (hero) | 3rem | 3.125rem | 700 | tight / arabicTight |
| H1 | 2.25rem | 2.375rem | 700 | tight / arabicTight |
| H2 | 1.875rem | 2rem | 600 | snug / arabicTight |
| H3 | 1.5rem | 1.625rem | 600 | snug / arabicNormal |
| H4 | 1.25rem | 1.375rem | 600 | normal / arabicNormal |
| Body large | 1.125rem | 1.1875rem | 400 | relaxed / arabicRelaxed |
| Body | 1rem | 1.0625rem | 400 | normal / arabicNormal |
| Small | 0.875rem | 0.9375rem | 400 | normal / arabicNormal |
| Caption | 0.75rem | 0.8125rem | 500 | normal / arabicNormal |

Measure is capped at **68ch** for Latin prose and **62ch** for Arabic — Arabic words average longer, so an identical character count produces an uncomfortably wide line.

### 3.3 Numerals

**Financial figures, license numbers, invoice numbers, membership numbers, national IDs, dates, and phone numbers render in Western digits (0-9) in both locales.**

This is a deliberate, slightly unusual choice, and the reason is transcription error. A member reading `١٢٤٥٠٠` off a screen and typing it into a bank app will make mistakes. Every Jordanian banking and government payment interface uses Western digits. Consistency with the systems these numbers travel into matters more than orthographic purity.

Eastern Arabic numerals (٠-٩) are permitted only in decorative or editorial contexts — a Hijri date in a formal announcement, for example.

---

## 4. RTL

Arabic is the **primary** layout. Every screen is designed in RTL and verified in LTR, not the reverse.

### 4.1 The absolute rule

**Logical properties only.**

```css
/* correct */
margin-inline-start: 1rem;
padding-inline-end: 0.5rem;
inset-inline-start: 0;
border-inline-start: 2px solid;
text-align: start;

/* wrong — a bug, not a style preference */
margin-left: 1rem;
padding-right: 0.5rem;
left: 0;
```

Tailwind's logical utilities (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`) are used throughout. A `ml-4` or `left-0` in a diff is a review rejection.

### 4.2 Icon mirroring inventory

| Mirror in RTL | Do **not** mirror |
|---|---|
| Arrows (all directions) | Calendar |
| Chevrons | Document / file |
| Back / forward / next / previous | Map pin |
| Breadcrumb separators | User / avatar |
| Progress and step indicators | Search (magnifier) |
| Send / reply | Clock |
| Undo / redo | Lock / unlock |
| Indent / outdent | Download / upload (vertical) |
| List bullets and numbering | Settings / gear |
| Chart axes and timelines | Checkmark / X |
| Sliders and range inputs | Phone / mail |
| Text alignment icons | Print |

The rule underneath the table: **icons encoding direction mirror; icons encoding objects do not.** A mirrored magnifier is just a wrong-handed magnifier.

### 4.3 Things that do not mirror

- **Numbers and Latin text inside Arabic** — bidi handles this; wrap in `<bdi>` where mixed content could reorder confusingly, which it will in addresses and license numbers.
- **Phone numbers** — always LTR, wrapped, or the `+962` prefix lands in the wrong place.
- **Media playback controls** — play still points right; users' muscle memory is universal here.
- **Logos.**

### 4.4 Layout consequences

- Sidebars anchor to the **inline-start** edge: right in Arabic, left in English.
- Tables read right-to-left in Arabic; the first column sits on the right. Numeric columns stay `text-align: end` in both directions so decimals align.
- Form labels sit inline-start of their inputs; validation messages inline-start-aligned.
- Charts flow right-to-left in Arabic. A time series starts on the right.

---

## 5. Spacing and layout

4px base scale. **Never a raw pixel value in a component.**

| Context | Rhythm |
|---|---|
| Inside a component (icon↔label, input↔hint) | `2` – `3` (8–12px) |
| Between related elements in a group | `4` – `6` (16–24px) |
| Between sections on a page | `12` – `16` (48–64px) |
| Between major page regions | `20` – `24` (80–96px) |

Grid: 12 columns, `1280px` max container, `4` gutter on mobile rising to `8` on desktop. The public site uses generous vertical rhythm; the dashboards compress to roughly two-thirds of it.

Radius: `md` (8px) for inputs and buttons, `lg` (12px) for cards, `full` for badges and avatars. Nothing above `xl` — heavy rounding reads consumer, and this system is not.

---

## 6. Components

**shadcn/ui as the base**, used unmodified where possible, plus an ASOO layer for domain concepts.

### 6.1 Primitives (from shadcn)
Button · Input · Select · Checkbox · Radio · Switch · Textarea · Dialog · Sheet · Dropdown · Popover · Tooltip · Tabs · Accordion · Alert · Toast · Skeleton · Avatar · Separator · Progress · Command

Every one is audited for RTL correctness before use. Several ship with directional assumptions baked in — dropdown alignment, sheet slide direction, and the accordion chevron all need checking.

### 6.2 ASOO components

| Component | Purpose |
|---|---|
| `StatusBadge` | Icon + label + status token triplet. **The only** way status is displayed anywhere in the system |
| `MoneyAmount` | Formats integer fils → `12.500 د.أ` / `12.500 JOD`. Tabular figures. The only money formatter |
| `InvoiceCard` | Invoice summary: number, type, amount, due date, status, pay action |
| `InvoiceLineTable` | Line items with an amount column aligned `end` in both directions |
| `PaymentSummary` | Pre-payment confirmation — what you are paying, how much, to whom |
| `MemberCard` | Directory result: name, office, license number, governorate, status |
| `MemberStatusPill` | The persistent dashboard status indicator |
| `CertificatePreview` | Certificate render with the QR verification block |
| `VerificationResult` | The public verify page outcome — deliberately spare |
| `GovLinkCard` | External government portal card with an explicit external-link indicator |
| `DocumentCard` | Library entry: category tag, title, reference, file type and size, download |
| `NewsCard` | Article teaser in list / grid / featured variants |
| `BlockRenderer` | Maps a CMS block type to its server component |
| `DataTable` | Server-paginated, sortable, filterable, RTL-aware, keyboard-navigable |
| `FileUpload` | Drag-drop with type/size validation and upload progress |
| `LocaleSwitcher` | Preserves path and query |
| `Breadcrumbs` | Mirrors the URL; direction-aware separator |
| `EmptyState` | Illustration + explanation + the action that resolves it |
| `AuditEntry` | Before/after diff rendering for the audit log viewer |

### 6.3 Interaction states

Every interactive element defines all six: **default · hover · focus-visible · active · disabled · loading.** A component missing any of them is incomplete.

**Focus is never removed.** 3px ring in `border.focus`, 2px offset, visible against every surface in the system. This is the single most commonly broken accessibility requirement and the easiest to get right.

**Touch targets are minimum 44×44px.** Field surveyors use this outdoors on phones, sometimes with gloves. A 32px tap target is a support ticket.

---

## 7. Motion

| Purpose | Duration | Easing |
|---|---|---|
| Hover, focus, small state change | `fast` (120ms) | standard |
| Dropdown, tooltip, popover | `normal` (200ms) | decelerate |
| Modal, sheet, drawer | `slow` (320ms) | decelerate |
| Exit | `fast` (120ms) | accelerate |

Sheets and drawers slide from the **inline-start** edge, so the direction flips with locale.

`prefers-reduced-motion: reduce` collapses all transitions to `instant` and disables the stat-counter count-up animation. This is honored globally at the CSS layer, not per-component.

---

## 8. Accessibility

**Target: WCAG 2.1 Level AA.** Government-affiliated systems are routinely held to this, and the syndicate should be able to state it publicly — hence the `/accessibility` statement page in the IA.

Requirements, all non-negotiable:

- **Contrast** — 4.5:1 body text, 3:1 large text and non-text UI. Enforced by the token build.
- **Keyboard** — every interactive element reachable and operable. Logical tab order, which in RTL means right-to-left. Focus trapped in modals, restored on close.
- **Screen readers** — semantic HTML first, ARIA only where semantics fall short. Landmark regions on every page. `aria-live` on payment status, form errors, and search results.
- **Language** — `lang` and `dir` correct on `<html>` and on **any subtree containing the other script**. An English office name inside an Arabic page needs its own `lang="en"`, or a screen reader will attempt to read English with Arabic phonetics.
- **Forms** — every input labelled (never placeholder-as-label), errors associated with `aria-describedby`, errors announced, and the first invalid field focused on submit.
- **Images** — alt text per locale, stored on `media_assets`. Decorative images `alt=""`.
- **Zoom** — usable at 200% without horizontal scrolling.
- **Motion** — `prefers-reduced-motion` honored.
- **Status** — never color alone.

### RTL screen-reader notes
Arabic screen reader support (NVDA, JAWS, VoiceOver) is real but less exercised than English. Test the critical flows — payment, renewal, certificate request — with an actual Arabic screen reader before launch. Mixed-direction content (an Arabic name beside a Western-digit license number) is where it breaks, and that combination is on nearly every screen in this system.

---

## 9. Content and voice

**Arabic:** Modern Standard Arabic, formal but not archaic. This is an official body — the register is that of a government letter, not a marketing email. Avoid the ornate constructions common in older Jordanian institutional writing; members need to understand their payment obligations quickly.

**English:** Plain, direct, no marketing language. The English audience is foreign investors, international bodies, and non-Arabic-speaking professionals who need facts.

**Both:**
- Errors say what happened, why, and what to do next. "حدث خطأ" (an error occurred) is not an error message.
- Money is always shown with its currency and to 3 decimals.
- Dates in Arabic show Hijri alongside Gregorian where the syndicate uses it: `١٥ رجب ١٤٤٧ / 2026-01-15`.
- Never machine-translate. Every English string is written or reviewed by a person.

---

## 10. Enforcement

| Rule | How it is enforced |
|---|---|
| No raw hex in components | ESLint rule on color literals in `.tsx` |
| No physical CSS properties | ESLint rule + Tailwind config restricting directional utilities |
| No hardcoded strings | ESLint `no-literal-string` on JSX text, with an allow-list |
| Contrast ratios | Automated check in `npm run tokens:build`; build fails below threshold |
| Focus visible | Global `:focus-visible` style; removing outline requires an explicit override that is flagged in review |
| Both locales render | Required check on any PR touching UI |
