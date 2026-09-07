import 'server-only'

/**
 * The counter e-services data source.
 *
 * Same shape as `reports-source.ts`: one async facade over two backends behind
 * identical domain types. Supabase (Postgres) whenever the app is configured,
 * an in-memory list otherwise so the deployed site still works before the keys
 * are set. Call sites `await` and never learn which answered.
 */

import { getUserSession } from '@/lib/auth/server'
import type { AuditedOp } from '@/lib/audit/atomic'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { getServiceClient } from '@/lib/supabase/server'
import type { ServiceRequestStatus, ServiceRequestType } from '@/lib/service-requests'

export interface ServiceRequest {
  id: string
  requestNumber: string
  type: ServiceRequestType
  status: ServiceRequestStatus
  dlsKey: string
  note: string
  requesterUid: string
  requesterName: string
  requesterEmail: string
  responseData: string | null
  responseNote: string | null
  respondedAt: string | null
  createdAt: string
}

export interface ServiceRequestEvent {
  id: string
  requestId: string
  actorId: string
  actorRole: string | null
  action: 'created' | 'taken' | 'fulfilled' | 'rejected' | 'note'
  message: string | null
  createdAt: string
}

interface ServiceRequestRow {
  id: string
  request_number: string
  type: string
  status: string
  dls_key: string
  note: string | null
  requester_user_id: string
  requester_name: string | null
  requester_email: string | null
  response_data: string | null
  response_note: string | null
  responded_by: string | null
  responded_at: string | null
  created_at: string
}

function mapRequest(row: ServiceRequestRow): ServiceRequest {
  return {
    id: row.id,
    requestNumber: row.request_number,
    type: row.type as ServiceRequestType,
    status: row.status as ServiceRequestStatus,
    dlsKey: row.dls_key,
    note: row.note ?? '',
    requesterUid: row.requester_user_id,
    requesterName: row.requester_name ?? '',
    requesterEmail: row.requester_email ?? '',
    responseData: row.response_data,
    responseNote: row.response_note,
    respondedAt: row.responded_at,
    createdAt: row.created_at,
  }
}

/* ------------------------------------------------- in-memory fallback store */

/**
 * Held on `globalThis`, not in a module-level `const`.
 *
 * The App Router compiles each route group into its own server bundle, so the
 * SAME source file is instantiated more than once — a plain module variable
 * gives the public route that writes a request and the dashboard route that
 * reads it two different arrays. Measured, not assumed: a submitted request
 * landed in an array of length 1 and the member's page read one of length 0.
 * One object on the global keeps every instance pointing at the same store.
 *
 * It still lives only as long as the process: this survives a navigation, not
 * a redeploy. That is the honest limit of the fallback, and it is why the
 * queue page tells staff when it is running without a database.
 */
interface MemoryStore {
  requests: ServiceRequest[]
  events: ServiceRequestEvent[]
  counter: number
}

const GLOBAL_KEY = Symbol.for('asoo.serviceRequests.memory')
const globalStore = globalThis as unknown as Record<symbol, MemoryStore | undefined>

const memory: MemoryStore = (globalStore[GLOBAL_KEY] ??= {
  requests: [],
  events: [],
  counter: 0,
})

function memoryNumber(): string {
  memory.counter += 1
  return `SR-${new Date().getUTCFullYear()}-${String(memory.counter).padStart(6, '0')}`
}

/* ----------------------------------------------------------------- creates */

/**
 * Describe creating a request, and its opening history row, as operations.
 *
 * The id is supplied rather than left to `gen_random_uuid()`, because the
 * event row has to reference it and the operations are described before any
 * of them runs. `request_number` is the opposite case and stays absent: it
 * comes from the column default (`next_service_request_number()`), so a
 * client cannot choose it, and `audited_write` hands the generated row back so
 * the member still learns their number without a second query.
 */
export function buildCreateOps(input: {
  id: string
  type: ServiceRequestType
  dlsKey: string
  note: string
  requesterUid: string
  requesterName: string
  requesterEmail: string
}): AuditedOp[] {
  return [
    {
      kind: 'insert',
      table: 'service_requests',
      values: {
        id: input.id,
        type: input.type,
        dls_key: input.dlsKey,
        note: input.note || null,
        requester_user_id: input.requesterUid,
        requester_name: input.requesterName || null,
        requester_email: input.requesterEmail || null,
      },
    },
    {
      kind: 'insert',
      table: 'service_request_events',
      values: {
        request_id: input.id,
        actor_id: input.requesterUid,
        actor_role: 'member',
        action: 'created',
      },
    },
  ]
}

export async function createServiceRequest(input: {
  type: ServiceRequestType
  dlsKey: string
  note: string
  requesterUid: string
  requesterName: string
  requesterEmail: string
}): Promise<ServiceRequest> {
  if (!isSupabaseConfigured()) {
    const request: ServiceRequest = {
      id: crypto.randomUUID(),
      requestNumber: memoryNumber(),
      type: input.type,
      status: 'submitted',
      dlsKey: input.dlsKey,
      note: input.note,
      requesterUid: input.requesterUid,
      requesterName: input.requesterName,
      requesterEmail: input.requesterEmail,
      responseData: null,
      responseNote: null,
      respondedAt: null,
      createdAt: new Date().toISOString(),
    }
    memory.requests.unshift(request)
    memory.events.unshift({
      id: crypto.randomUUID(),
      requestId: request.id,
      actorId: input.requesterUid,
      actorRole: 'member',
      action: 'created',
      message: null,
      createdAt: request.createdAt,
    })
    return request
  }

  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('service_requests')
    .insert({
      type: input.type,
      dls_key: input.dlsKey,
      note: input.note || null,
      requester_user_id: input.requesterUid,
      requester_name: input.requesterName || null,
      requester_email: input.requesterEmail || null,
    })
    // request_number and id are DB-generated — never accepted from the client.
    .select('*')
    .single()
  if (error) throw error

  const request = mapRequest(data as ServiceRequestRow)
  // History first-class from the start: the queue reads "who asked, when" from
  // the same append-only table it reads every later decision from.
  const { error: eventError } = await supabase.from('service_request_events').insert({
    request_id: request.id,
    actor_id: input.requesterUid,
    actor_role: 'member',
    action: 'created',
  })
  if (eventError) throw eventError

  return request
}

/* ------------------------------------------------------------------- reads */

export async function listRequestsForUser(uid: string): Promise<ServiceRequest[]> {
  if (!isSupabaseConfigured()) {
    return memory.requests.filter((r) => r.requesterUid === uid)
  }
  const { data, error } = await getServiceClient()
    .from('service_requests')
    .select('*')
    .eq('requester_user_id', uid)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as ServiceRequestRow[]).map(mapRequest)
}

export async function getServiceRequest(id: string): Promise<ServiceRequest | null> {
  if (!isSupabaseConfigured()) {
    return memory.requests.find((r) => r.id === id) ?? null
  }
  const { data, error } = await getServiceClient()
    .from('service_requests')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data ? mapRequest(data as ServiceRequestRow) : null
}

/** The staff queue: everything still awaiting an answer, oldest first. */
export async function listOpenRequests(): Promise<ServiceRequest[]> {
  if (!isSupabaseConfigured()) {
    return memory.requests
      .filter((r) => r.status === 'submitted' || r.status === 'in_progress')
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }
  const { data, error } = await getServiceClient()
    .from('service_requests')
    .select('*')
    .in('status', ['submitted', 'in_progress'])
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data as ServiceRequestRow[]).map(mapRequest)
}

/** Recently closed requests, so staff can see and re-read what they sent. */
export async function listClosedRequests(limit = 20): Promise<ServiceRequest[]> {
  if (!isSupabaseConfigured()) {
    return memory.requests
      .filter((r) => r.status === 'fulfilled' || r.status === 'rejected')
      .slice(0, limit)
  }
  const { data, error } = await getServiceClient()
    .from('service_requests')
    .select('*')
    .in('status', ['fulfilled', 'rejected'])
    .order('responded_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data as ServiceRequestRow[]).map(mapRequest)
}

/* ------------------------------------------------------------------ writes */

/**
 * Describe answering a request as operations, for `withAtomicAudit`.
 *
 * Two writes — the immutable event row and the status change — which used to
 * be two HTTP requests with a comment explaining which order failed less
 * badly. They now go in one transaction, so neither can land without the
 * other and the ordering argument is moot.
 */
export function buildAnswerOps(input: {
  id: string
  status: Extract<ServiceRequestStatus, 'fulfilled' | 'rejected' | 'in_progress'>
  responseData?: string
  responseNote?: string
  actorId: string
  actorRole: string | null
}): AuditedOp[] {
  const action =
    input.status === 'fulfilled'
      ? 'fulfilled'
      : input.status === 'rejected'
        ? 'rejected'
        : 'taken'

  const patch: Record<string, unknown> = { status: input.status }
  if (input.status !== 'in_progress') {
    // Empty stays NULL: "answered with nothing" and "not answered" are
    // different facts, and the member's page renders them differently.
    patch.response_data = input.responseData?.trim() || null
    patch.response_note = input.responseNote?.trim() || null
    patch.responded_by = input.actorId
    patch.responded_at = new Date().toISOString()
  }

  return [
    {
      kind: 'insert',
      table: 'service_request_events',
      values: {
        request_id: input.id,
        actor_id: input.actorId,
        actor_role: input.actorRole,
        action,
        message: input.responseNote?.trim() || null,
      },
    },
    {
      kind: 'update',
      table: 'service_requests',
      match: { id: input.id },
      values: patch,
    },
  ]
}

/**
 * Answer a request — the in-memory fallback path.
 *
 * Kept for the no-Supabase case only. When Supabase is configured the action
 * uses `buildAnswerOps` with `withAtomicAudit` instead, so the two writes and
 * the audit row share one transaction.
 */
export async function answerServiceRequest(input: {
  id: string
  status: Extract<ServiceRequestStatus, 'fulfilled' | 'rejected' | 'in_progress'>
  responseData?: string
  responseNote?: string
}): Promise<ServiceRequest | null> {
  const session = await getUserSession()
  const actorId = session?.uid ?? 'system'
  const action =
    input.status === 'fulfilled' ? 'fulfilled' : input.status === 'rejected' ? 'rejected' : 'taken'

  if (!isSupabaseConfigured()) {
    const request = memory.requests.find((r) => r.id === input.id)
    if (!request) return null
    request.status = input.status
    if (input.status !== 'in_progress') {
      request.responseData = input.responseData?.trim() || null
      request.responseNote = input.responseNote?.trim() || null
      request.respondedAt = new Date().toISOString()
    }
    memory.events.unshift({
      id: crypto.randomUUID(),
      requestId: request.id,
      actorId,
      actorRole: session?.role ?? null,
      action,
      message: input.responseNote?.trim() || null,
      createdAt: new Date().toISOString(),
    })
    return request
  }

  const supabase = getServiceClient()
  const { error: eventError } = await supabase.from('service_request_events').insert({
    request_id: input.id,
    actor_id: actorId,
    actor_role: session?.role ?? null,
    action,
    message: input.responseNote?.trim() || null,
  })
  if (eventError) throw eventError

  const patch: Record<string, unknown> = { status: input.status }
  if (input.status !== 'in_progress') {
    // Empty stays NULL: "answered with nothing" and "not answered" are
    // different facts, and the member's page renders them differently.
    patch.response_data = input.responseData?.trim() || null
    patch.response_note = input.responseNote?.trim() || null
    patch.responded_by = actorId
    patch.responded_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('service_requests')
    .update(patch)
    .eq('id', input.id)
    .select('*')
    .maybeSingle()
  if (error) throw error
  return data ? mapRequest(data as ServiceRequestRow) : null
}
