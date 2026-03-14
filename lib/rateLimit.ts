// ─── In-memory sliding-window rate limiter ────────────────────────────────────
// Works for single-instance Next.js deployments (dev + small prod).
// For multi-instance production, replace the Map with Redis + Upstash.

interface WindowEntry {
  count: number
  resetAt: number
}

const store = new Map<string, WindowEntry>()

/** Clean up expired entries every 5 minutes to prevent memory leaks. */
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt < now) store.delete(key)
  }
}, 5 * 60 * 1_000)

export interface RateLimitOptions {
  /** Max requests allowed per window */
  max: number
  /** Window size in milliseconds */
  windowMs: number
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

/**
 * Check + increment request count for a given key.
 * @param key   Unique identifier (e.g. `login:${ip}`)
 * @param opts  Rate limit configuration
 */
export function checkRateLimit(key: string, opts: RateLimitOptions): RateLimitResult {
  const now = Date.now()
  let entry = store.get(key)

  if (!entry || entry.resetAt < now) {
    entry = { count: 0, resetAt: now + opts.windowMs }
    store.set(key, entry)
  }

  entry.count++
  const allowed   = entry.count <= opts.max
  const remaining = Math.max(0, opts.max - entry.count)

  return { allowed, remaining, resetAt: entry.resetAt }
}

// ─── Preset Limiters ──────────────────────────────────────────────────────────

/** 10 login/register attempts per IP per 15 minutes */
export const AUTH_LIMIT: RateLimitOptions = { max: 10, windowMs: 15 * 60 * 1_000 }

/** 5 OTP requests per email per 10 minutes */
export const OTP_LIMIT: RateLimitOptions  = { max: 5,  windowMs: 10 * 60 * 1_000 }

/** 200 general API calls per IP per minute */
export const API_LIMIT: RateLimitOptions  = { max: 200, windowMs: 60 * 1_000 }
