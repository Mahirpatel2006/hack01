import { checkRateLimit } from '@/lib/rateLimit'

describe('lib/rateLimit', () => {
  it('allows requests within the limit', () => {
    const key = `test:${Date.now()}`
    const opts = { max: 3, windowMs: 60_000 }
    expect(checkRateLimit(key, opts).allowed).toBe(true)
    expect(checkRateLimit(key, opts).allowed).toBe(true)
    expect(checkRateLimit(key, opts).allowed).toBe(true)
  })

  it('blocks when limit exceeded', () => {
    const key = `test-block:${Date.now()}`
    const opts = { max: 2, windowMs: 60_000 }
    checkRateLimit(key, opts)
    checkRateLimit(key, opts)
    const result = checkRateLimit(key, opts)
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it('returns correct remaining count', () => {
    const key = `test-remaining:${Date.now()}`
    const opts = { max: 5, windowMs: 60_000 }
    checkRateLimit(key, opts)
    const result = checkRateLimit(key, opts)
    expect(result.remaining).toBe(3)
  })

  it('uses separate counters per key', () => {
    const opts = { max: 1, windowMs: 60_000 }
    expect(checkRateLimit(`a:${Date.now()}`, opts).allowed).toBe(true)
    expect(checkRateLimit(`b:${Date.now()}`, opts).allowed).toBe(true)
  })
})
