/**
 * DEMONSTRATION FIXTURES FOR THE MEMBER DASHBOARD — DELETE IN PHASE 3.
 *
 * Bound to the mock member session (`mock-uid-member`). Phase 3 replaces every
 * read here with an `auth.uid`-scoped Data Connect query, so a member can only
 * ever see their own records — see docs/08-security.md §5. These fixtures are
 * not real data and must never reach production.
 *
 * Money is INTEGER FILS throughout — CLAUDE.md §7. 1 JOD = 1000 fils. There is
 * not a single float in this file, and there must never be.
 */

export type InvoiceStatus = 'issued' | 'partially_paid' | 'paid' | 'overdue'
export type InvoiceType = 'subscription' | 'renewal' | 'certificate' | 'penalty'

export interface DemoInvoiceLine {
  descriptionKey: string
  quantity: number
  unitAmountFils: number
}

export interface DemoInvoice {
  id: string
  invoiceNumber: string
  publicReference: string
  type: InvoiceType
  status: InvoiceStatus
  issuedAt: string
  dueAt: string
  settledAt: string | null
  lines: DemoInvoiceLine[]
  paidFils: number
}

export type CertificateStatus = 'valid' | 'expired' | 'revoked'
export type CertificateRequestStatus =
  | 'submitted'
  | 'under_review'
  | 'issued'
  | 'rejected'

export interface DemoCertificate {
  id: string
  typeKey: string
  status: CertificateRequestStatus
  certificateStatus: CertificateStatus | null
  verificationCode: string | null
  requestedAt: string
  issuedAt: string | null
  expiresAt: string | null
}

export type ComplaintStatus =
  | 'submitted'
  | 'triaged'
  | 'in_progress'
  | 'resolved'
  | 'closed'

export interface DemoComplaintMessage {
  id: string
  authorKey: 'member' | 'staff'
  body: string
  createdAt: string
}

export interface DemoComplaint {
  id: string
  complaintNumber: string
  typeKey: string
  status: ComplaintStatus
  subject: string
  createdAt: string
  updatedAt: string
  messages: DemoComplaintMessage[]
}

export type RenewalStatus =
  | 'not_open'
  | 'open'
  | 'submitted'
  | 'under_review'
  | 'approved'

export interface DemoNotification {
  id: string
  kind: 'renewal' | 'overdue' | 'certificate' | 'announcement'
  titleKey: string
  createdAt: string
  read: boolean
}

/** The signed-in demo member's own record. Mirrors `members[0]` in seed.ts. */
export const memberProfile = {
  id: 'm01',
  userId: 'mock-uid-member',
  licenseNumber: 'SV-1042',
  membershipNumber: 'ASOO-0412',
  status: 'active' as const,
  categoryKey: 'officeOwner',
  governorateCode: 'amman',
  joinedAt: '2004-03-14',
  licenseExpiresAt: '2026-12-31',
  membershipYear: 2026,
  fullName: { ar: 'أحمد وليد المصري', en: 'Ahmad Waleed Al-Masri' },
  officeName: { ar: 'مكتب الميزان للمساحة', en: 'Al-Mizan Surveying Office' },
  // Contact of record, distinct from the directory-published set below.
  phone: '+962 6 461 2233',
  email: 'info@almizan-survey.jo',
  isDirectoryVisible: true,
  directoryPhone: '+962 6 461 2233',
  directoryEmail: 'info@almizan-survey.jo',
  directoryAddress: { ar: 'عمّان — جبل الحسين', en: 'Amman — Jabal Al-Hussein' },
  specializations: {
    ar: ['إفراز الأراضي', 'المساحة الميدانية'],
    en: ['Land subdivision', 'Field survey'],
  },
}

/**
 * Invoices, sorted here newest-first but rendered OVERDUE-FIRST — an overdue
 * bill is the most consequential thing in the account. docs/06-ux-flows.md §2.
 * Amounts are fils: 120000 = 120.000 JOD.
 */
export const memberInvoices: DemoInvoice[] = [
  {
    id: 'inv-2026-1',
    invoiceNumber: 'ASOO-2026-000412',
    publicReference: 'K7P2QX9M4T1A',
    type: 'subscription',
    status: 'overdue',
    issuedAt: '2026-01-05',
    dueAt: '2026-02-05',
    settledAt: null,
    paidFils: 0,
    lines: [
      { descriptionKey: 'lineAnnualOfficeOwner', quantity: 1, unitAmountFils: 120000 },
      { descriptionKey: 'lineLatePenalty', quantity: 1, unitAmountFils: 15000 },
    ],
  },
  {
    id: 'inv-2025-cert',
    invoiceNumber: 'ASOO-2025-002204',
    publicReference: 'B3H8LT6Z0R5C',
    type: 'certificate',
    status: 'paid',
    issuedAt: '2025-06-11',
    dueAt: '2025-06-25',
    settledAt: '2025-06-13',
    paidFils: 25000,
    lines: [{ descriptionKey: 'lineGoodStanding', quantity: 1, unitAmountFils: 25000 }],
  },
  {
    id: 'inv-2025-1',
    invoiceNumber: 'ASOO-2025-000388',
    publicReference: 'F9D1WK4N7Y2E',
    type: 'subscription',
    status: 'paid',
    issuedAt: '2025-01-06',
    dueAt: '2025-02-06',
    settledAt: '2025-01-22',
    paidFils: 120000,
    lines: [{ descriptionKey: 'lineAnnualOfficeOwner', quantity: 1, unitAmountFils: 120000 }],
  },
]

export const memberCertificates: DemoCertificate[] = [
  {
    id: 'cert-1',
    typeKey: 'goodStanding',
    status: 'issued',
    certificateStatus: 'valid',
    verificationCode: 'ASOO-VER-7QK2-P9M4-T1A6',
    requestedAt: '2025-06-11',
    issuedAt: '2025-06-13',
    expiresAt: '2026-06-13',
  },
  {
    id: 'cert-2',
    typeKey: 'membership',
    status: 'under_review',
    certificateStatus: null,
    verificationCode: null,
    requestedAt: '2026-01-20',
    issuedAt: null,
    expiresAt: null,
  },
]

export const memberComplaints: DemoComplaint[] = [
  {
    id: 'cmp-1',
    complaintNumber: 'ASOO-C-2025-0091',
    typeKey: 'boundaryDispute',
    status: 'in_progress',
    subject: 'نزاع حدودي على قطعة أرض في لواء الجامعة',
    createdAt: '2025-11-02',
    updatedAt: '2025-11-20',
    messages: [
      {
        id: 'msg-1',
        authorKey: 'member',
        body: 'أرغب في الإبلاغ عن تداخل في الحدود مع القطعة المجاورة حسب المخطط المرفق.',
        createdAt: '2025-11-02',
      },
      {
        id: 'msg-2',
        authorKey: 'staff',
        body: 'تم استلام الشكوى وتحويلها إلى اللجنة الفنية للمراجعة. سنوافيكم بالمستجدات.',
        createdAt: '2025-11-05',
      },
    ],
  },
]

export const memberRenewal = {
  membershipYear: 2026,
  status: 'open' as RenewalStatus,
  opensAt: '2026-01-01',
  dueAt: '2026-02-28',
}

export const memberNotifications: DemoNotification[] = [
  { id: 'n1', kind: 'overdue', titleKey: 'notifOverdue', createdAt: '2026-02-06', read: false },
  { id: 'n2', kind: 'renewal', titleKey: 'notifRenewalOpen', createdAt: '2026-01-01', read: false },
  { id: 'n3', kind: 'certificate', titleKey: 'notifCertIssued', createdAt: '2025-06-13', read: true },
]

/** Outstanding balance = sum of unpaid portions across non-settled invoices. */
export function outstandingFils(invoices: DemoInvoice[] = memberInvoices): number {
  return invoices
    .filter((i) => i.status === 'overdue' || i.status === 'issued' || i.status === 'partially_paid')
    .reduce((sum, i) => sum + invoiceTotalFils(i) - i.paidFils, 0)
}

export function invoiceTotalFils(invoice: DemoInvoice): number {
  return invoice.lines.reduce((sum, l) => sum + l.unitAmountFils * l.quantity, 0)
}
