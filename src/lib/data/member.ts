import 'server-only'

import {
  memberCertificates,
  memberComplaints,
  memberInvoices,
  memberNotifications,
  memberProfile,
  memberRenewal,
  outstandingFils,
  type DemoInvoice,
} from './member-demo'

/**
 * Read facade for the signed-in member's own records.
 *
 * PHASE 2 SCAFFOLD. Every function returns the mock member's demo data. Phase 3
 * replaces this with `auth.uid`-bound Data Connect queries so a member is
 * physically incapable of reading another member's records — docs/08-security
 * §5. The `uid` argument is already threaded through so that swap is local.
 */

export function getMemberProfile(_uid: string) {
  return memberProfile
}

export function getMemberInvoices(_uid: string): DemoInvoice[] {
  // Overdue first, then issued, then most-recent settled.
  const rank: Record<DemoInvoice['status'], number> = {
    overdue: 0,
    issued: 1,
    partially_paid: 1,
    paid: 2,
  }
  return [...memberInvoices].sort(
    (a, b) => rank[a.status] - rank[b.status] || b.issuedAt.localeCompare(a.issuedAt),
  )
}

export function getMemberInvoice(_uid: string, id: string): DemoInvoice | null {
  return memberInvoices.find((i) => i.id === id) ?? null
}

export function getMemberCertificates(_uid: string) {
  return memberCertificates
}

export function getMemberComplaints(_uid: string) {
  return memberComplaints
}

export function getMemberComplaint(_uid: string, id: string) {
  return memberComplaints.find((c) => c.id === id) ?? null
}

export function getMemberRenewal(_uid: string) {
  return memberRenewal
}

export function getMemberNotifications(_uid: string) {
  return memberNotifications
}

export function getMemberOutstandingFils(_uid: string): number {
  return outstandingFils(memberInvoices)
}

export function getMemberUnreadCount(_uid: string): number {
  return memberNotifications.filter((n) => !n.read).length
}

/** True when the member has no overdue balance — the gate for certificates. */
export function isInGoodStanding(_uid: string): boolean {
  return !memberInvoices.some((i) => i.status === 'overdue')
}
