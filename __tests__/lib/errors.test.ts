import { AppError, Errors } from '@/lib/errors'

describe('lib/errors', () => {
  describe('AppError', () => {
    it('creates an error with default status 500', () => {
      const err = new AppError('Something broke')
      expect(err.message).toBe('Something broke')
      expect(err.statusCode).toBe(500)
      expect(err.name).toBe('AppError')
    })
    it('creates an error with custom status', () => {
      const err = new AppError('Not found', 404, 'NOT_FOUND')
      expect(err.statusCode).toBe(404)
      expect(err.code).toBe('NOT_FOUND')
    })
    it('instanceof Error is true', () => {
      const err = new AppError('test')
      expect(err instanceof Error).toBe(true)
    })
  })

  describe('Errors factory', () => {
    it('unauthorized returns 401', () => expect(Errors.unauthorized().statusCode).toBe(401))
    it('forbidden returns 403',    () => expect(Errors.forbidden().statusCode).toBe(403))
    it('notFound returns 404',     () => expect(Errors.notFound().statusCode).toBe(404))
    it('badRequest returns 400',   () => expect(Errors.badRequest('Invalid').statusCode).toBe(400))
    it('conflict returns 409',     () => expect(Errors.conflict('Dup').statusCode).toBe(409))
    it('tooManyRequest returns 429', () => expect(Errors.tooManyRequest().statusCode).toBe(429))
    it('internal returns 500',     () => expect(Errors.internal().statusCode).toBe(500))
  })
})
