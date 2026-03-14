export interface ValidationResult {
  ok: boolean
  error?: string
}

const EMAIL_REGEX = /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/

export function validateEmail(email: unknown): ValidationResult {
  if (typeof email !== 'string' || email.trim().length === 0)
    return { ok: false, error: 'Email is required.' }
  if (!EMAIL_REGEX.test(email.trim()))
    return { ok: false, error: 'Enter a valid email address.' }
  if (email.length > 255)
    return { ok: false, error: 'Email address is too long.' }
  return { ok: true }
}

export function validatePassword(password: unknown): ValidationResult {
  if (typeof password !== 'string' || password.length === 0)
    return { ok: false, error: 'Password is required.' }
  if (password.length < 8)
    return { ok: false, error: 'Password must be at least 8 characters.' }
  if (password.length > 128)
    return { ok: false, error: 'Password is too long.' }
  return { ok: true }
}

export function validateFullName(name: unknown): ValidationResult {
  if (typeof name !== 'string' || name.trim().length === 0)
    return { ok: false, error: 'Full name is required.' }
  if (name.trim().length < 2)
    return { ok: false, error: 'Full name must be at least 2 characters.' }
  if (name.length > 255)
    return { ok: false, error: 'Full name is too long.' }
  return { ok: true }
}

export function validateOtp(otp: unknown): ValidationResult {
  if (typeof otp !== 'string' || otp.trim().length === 0)
    return { ok: false, error: 'Verification code is required.' }
  if (!/^\d{6}$/.test(otp.trim()))
    return { ok: false, error: 'Code must be exactly 6 digits.' }
  return { ok: true }
}

/** Trim and strip null bytes from any user-supplied string. */
export function sanitize(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.trim().replace(/\0/g, '')
}
