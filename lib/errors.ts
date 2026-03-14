import { NextResponse } from 'next/server'

// ─── Typed Application Error ───────────────────────────────────────────────────

export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500,
    public readonly code?: string,
    public readonly details?: Record<string, string>
  ) {
    super(message)
    this.name = 'AppError'
  }
}

// ─── Common Error Factories ────────────────────────────────────────────────────

export const Errors = {
  unauthorized:   (msg = 'Unauthorized.')          => new AppError(msg, 401, 'UNAUTHORIZED'),
  forbidden:      (msg = 'Forbidden.')             => new AppError(msg, 403, 'FORBIDDEN'),
  notFound:       (msg = 'Not found.')             => new AppError(msg, 404, 'NOT_FOUND'),
  badRequest:     (msg: string)                    => new AppError(msg, 400, 'BAD_REQUEST'),
  conflict:       (msg: string)                    => new AppError(msg, 409, 'CONFLICT'),
  tooManyRequest: (msg = 'Too many requests.')     => new AppError(msg, 429, 'RATE_LIMITED'),
  internal:       (msg = 'Internal server error.') => new AppError(msg, 500, 'INTERNAL'),
}

// ─── Route Handler Error-to-Response Converter ────────────────────────────────

export function handleRouteError(err: unknown, context = 'route'): NextResponse {
  if (err instanceof AppError) {
    return NextResponse.json(
      { error: err.message, code: err.code, ...(err.details ? { details: err.details } : {}) },
      { status: err.statusCode }
    )
  }
  const msg = err instanceof Error ? err.message : 'Internal server error.'
  console.error(`[${context}]`, err)
  return NextResponse.json({ error: msg, code: 'INTERNAL' }, { status: 500 })
}
