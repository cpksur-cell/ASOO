import { NextResponse } from 'next/server'

import { createAuthClient } from '@/lib/supabase/auth-server'

/**
 * Sign out.
 *
 * Revokes the Supabase session server-side rather than only dropping the
 * cookie locally: a token that is merely forgotten by the browser is still a
 * valid token until it expires. `signOut` invalidates the refresh token at the
 * auth server, so a copied cookie stops working immediately — which is what
 * "log me out" has to mean on a system holding identity documents.
 *
 * The development mock cookies are cleared alongside it.
 */
export async function POST() {
  try {
    const supabase = await createAuthClient()
    await supabase?.auth.signOut()
  } catch {
    // Never leave the user stuck signed-in-looking because the auth service
    // hiccuped — fall through and clear the cookies regardless.
  }

  const response = NextResponse.json({ success: true })
  response.cookies.delete('asoo_mock_role')
  response.cookies.delete('asoo_mock_user')
  return response
}
