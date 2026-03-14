import bcrypt from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'
import { v4 as uuidv4 } from 'uuid'

const SALT_ROUNDS = 12
const JWT_EXPIRY  = '7d'
export const COOKIE_NAME = 'hb_token'

export interface JWTPayload {
  sub:   string   // user UUID
  email: string
  role:  string   // 'manager' | 'staff'
  jti:   string   // unique token ID — enables session revocation
}

function getSecret(): Uint8Array {
  const s = process.env.JWT_SECRET
  if (!s || s.length < 32) throw new Error('JWT_SECRET missing or too short')
  return new TextEncoder().encode(s)
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS)
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}

export async function signToken(payload: Omit<JWTPayload, 'jti'>): Promise<string> {
  return new SignJWT({ ...payload, jti: uuidv4() })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRY)
    .sign(getSecret())
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    return payload as unknown as JWTPayload
  } catch { return null }
}

/** Cryptographically safe 6-digit OTP, zero-padded. */
export function generateOtp(): string {
  const bytes = new Uint8Array(4)
  crypto.getRandomValues(bytes)
  const num = new DataView(bytes.buffer).getUint32(0) % 1_000_000
  return num.toString().padStart(6, '0')
}

/** Standard cookie options for hb_token. */
export function cookieOptions(maxAge = 60 * 60 * 24 * 7) {
  return {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    maxAge,
    path: '/',
  }
}
