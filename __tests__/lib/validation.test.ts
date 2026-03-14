import { validateEmail, validatePassword, validateFullName, validateOtp, sanitize } from '@/lib/validation'

describe('lib/validation', () => {
  describe('validateEmail', () => {
    it('accepts valid email addresses', () => {
      expect(validateEmail('user@example.com').ok).toBe(true)
    })
    it('rejects empty / missing email', () => {
      expect(validateEmail('').ok).toBe(false)
      expect(validateEmail(null).ok).toBe(false)
    })
    it('rejects malformed email', () => {
      expect(validateEmail('not-an-email').ok).toBe(false)
    })
  })

  describe('validatePassword', () => {
    it('accepts password >= 8 chars', () => {
      expect(validatePassword('secure123').ok).toBe(true)
    })
    it('rejects short passwords', () => {
      expect(validatePassword('short').ok).toBe(false)
    })
    it('rejects empty / non-string', () => {
      expect(validatePassword('').ok).toBe(false)
    })
  })

  describe('validateFullName', () => {
    it('accepts valid names', () => {
      expect(validateFullName('Alice Smith').ok).toBe(true)
    })
    it('rejects single-char names', () => {
      expect(validateFullName('A').ok).toBe(false)
    })
    it('rejects empty', () => {
      expect(validateFullName('').ok).toBe(false)
    })
  })

  describe('validateOtp', () => {
    it('accepts 6-digit strings', () => {
      expect(validateOtp('123456').ok).toBe(true)
    })
    it('rejects non-6-digit values', () => {
      expect(validateOtp('12345').ok).toBe(false)
      expect(validateOtp('').ok).toBe(false)
    })
  })

  describe('sanitize', () => {
    it('trims whitespace', () => {
      expect(sanitize('  hello  ')).toBe('hello')
    })
    it('returns empty string for non-strings', () => {
      expect(sanitize(null)).toBe('')
      expect(sanitize(undefined)).toBe('')
    })
  })
})
