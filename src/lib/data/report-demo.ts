/**
 * DEMONSTRATION FIXTURES for orders, report submissions, and approvals —
 * DELETE IN PHASE 3.
 *
 * Content (order titles, parcel references) that lives in PostgreSQL in Phase 3.
 * Kept here, not in store.ts, so the store stays logic-only and free of literal
 * strings. Allow-listed by the i18n audit, like seed.ts and member-demo.ts.
 */
import type {
  OrderType,
  ReportFileType,
  StoredApproval,
  StoredOrder,
  StoredSubmission,
  SubmissionStatus,
} from './store'

export const DEMO_ORDERS: StoredOrder[] = [
  {
    id: 'ord-1',
    orderNumber: 'ORD-2026-000418',
    ownerUid: 'mock-uid-member',
    type: 'land_subdivision' as OrderType,
    title: 'إفراز قطعة أرض حوض 3 — الجبيهة',
    parcelReference: 'حوض 3 / قطعة 214',
    clientName: 'شركة الإسكان الأردنية',
    governorateCode: 'amman',
    createdAt: '2026-01-18',
  },
  {
    id: 'ord-2',
    orderNumber: 'ORD-2026-000512',
    ownerUid: 'mock-uid-member',
    type: 'topographic_survey' as OrderType,
    title: 'رفع مساحي طبوغرافي — لواء الجامعة',
    parcelReference: 'حوض 7 / قطعة 88',
    clientName: 'أمانة عمّان الكبرى',
    governorateCode: 'amman',
    createdAt: '2026-02-02',
  },
  {
    id: 'ord-3',
    orderNumber: 'ORD-2026-000377',
    ownerUid: 'mock-uid-member',
    type: 'boundary_survey' as OrderType,
    title: 'تحديد حدود قطعة — إربد',
    parcelReference: 'حوض 12 / قطعة 45',
    clientName: 'مالك خاص',
    governorateCode: 'irbid',
    createdAt: '2026-01-06',
  },
]

export const DEMO_SUBMISSIONS: StoredSubmission[] = [
  {
    id: 'sub-1',
    orderId: 'ord-3',
    submittedByUid: 'mock-uid-member',
    fileType: 'pdf' as ReportFileType,
    fileName: 'boundary-report-irbid.pdf',
    fileSize: 2_340_000,
    version: 1,
    status: 'approved' as SubmissionStatus,
    note: 'التقرير النهائي بعد الرفع الميداني.',
    reviewComment: 'مطابق للأصول الفنية.',
    createdAt: '2026-01-08',
  },
  {
    id: 'sub-2',
    orderId: 'ord-1',
    submittedByUid: 'mock-uid-member',
    fileType: 'dwg' as ReportFileType,
    fileName: 'subdivision-plan-juba.dwg',
    fileSize: 5_120_000,
    version: 1,
    status: 'under_review' as SubmissionStatus,
    note: 'مخطط الإفراز المبدئي.',
    reviewComment: null,
    createdAt: '2026-01-20',
  },
]

export const DEMO_APPROVALS: StoredApproval[] = [
  {
    approvalNumber: 'APR-2026-000091',
    submissionId: 'sub-1',
    orderId: 'ord-3',
    verificationCode: 'ASOO-RPT-4K7Q-P9M2-T1A6',
    status: 'valid',
    approvedByUid: 'mock-uid-membership_officer',
    issuedAt: '2026-01-10',
  },
]
