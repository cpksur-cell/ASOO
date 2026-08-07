import { NextResponse, type NextRequest } from 'next/server'

import {
  isMockAuthEnabled,
  isMockRole,
  MOCK_ROLE_COOKIE,
  MOCK_USER_COOKIE,
} from '@/lib/auth/mock'

/**
 * Development-only role impersonation.
 *
 * DANGER: this endpoint issues a session for whatever role it is asked for.
 * It is gated by `isMockAuthEnabled()` — see the reasoning in lib/auth/mock.ts.
 * Do not weaken that guard, and do not add a bypass "just for staging".
 *
 * Returns 404 (not 403) when disabled, so a probe cannot even confirm the
 * route exists in production.
 */
export async function POST(req: NextRequest) {
  if (!isMockAuthEnabled()) {
    return new NextResponse(null, { status: 404 })
  }

  let role: unknown
  try {
    ;({ role } = await req.json())
  } catch {
    return NextResponse.json({ error: 'Malformed request body' }, { status: 400 })
  }

  // An allow-list, not a truthiness check. Previously any string was accepted,
  // which meant the client chose its own authority.
  if (!isMockRole(role)) {
    return NextResponse.json({ error: 'Unknown role' }, { status: 400 })
  }

  const response = NextResponse.json({ success: true, role })

  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    // Hours, not a week. A mock session is for a dev sitting at the machine.
    maxAge: 60 * 60 * 8,
  }

  response.cookies.set(MOCK_ROLE_COOKIE, role, options)
  response.cookies.set(MOCK_USER_COOKIE, `mock-uid-${role}`, options)

  return response
}
