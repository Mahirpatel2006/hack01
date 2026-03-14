import { cookies } from 'next/headers'
import { verifyToken, COOKIE_NAME, type JWTPayload } from './auth'

/** Read and verify JWT from cookie. Call in Server Components or Route Handlers. */
export async function getSession(): Promise<JWTPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null
  return verifyToken(token)
}
