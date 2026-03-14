import { NextResponse, type NextRequest } from 'next/server'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { query } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get(COOKIE_NAME)?.value
    if (token) {
      const payload = await verifyToken(token)
      if (payload?.jti) {
        await query(
          'UPDATE sessions SET revoked = TRUE WHERE jti = $1',
          [payload.jti]
        )
      }
    }

    const response = NextResponse.json({ success: true })
    response.cookies.set(COOKIE_NAME, '', { maxAge: 0, path: '/' })
    return response

  } catch (err) {
    console.error('[logout]', err)
    // Even on error, clear the cookie
    const response = NextResponse.json({ success: true })
    response.cookies.set(COOKIE_NAME, '', { maxAge: 0, path: '/' })
    return response
  }
}
