import { NextResponse } from 'next/server'
import { getUserSession } from '@/lib/auth/server'

export async function GET() {
  const session = await getUserSession()
  return NextResponse.json({ user: session })
}
