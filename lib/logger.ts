// ─── Structured Logger ─────────────────────────────────────────────────────────
// Wraps console.* with ISO timestamps, log levels, and context labels.
// In production you could swap this for a proper logger (pino, winston, etc.)

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  level: LogLevel
  context: string
  message: string
  data?: unknown
  timestamp: string
}

function log(level: LogLevel, context: string, message: string, data?: unknown) {
  const entry: LogEntry = {
    level,
    context,
    message,
    timestamp: new Date().toISOString(),
    ...(data !== undefined ? { data } : {}),
  }

  const prefix = `[${entry.timestamp}] [${level.toUpperCase()}] [${context}]`

  switch (level) {
    case 'debug': console.debug(prefix, message, data ?? ''); break
    case 'info':  console.log(prefix, message, data ?? '');   break
    case 'warn':  console.warn(prefix, message, data ?? '');  break
    case 'error': console.error(prefix, message, data ?? ''); break
  }

  // Future: send to external logging service here
  return entry
}

export const logger = {
  debug: (ctx: string, msg: string, data?: unknown) => log('debug', ctx, msg, data),
  info:  (ctx: string, msg: string, data?: unknown) => log('info',  ctx, msg, data),
  warn:  (ctx: string, msg: string, data?: unknown) => log('warn',  ctx, msg, data),
  error: (ctx: string, msg: string, data?: unknown) => log('error', ctx, msg, data),

  /** Convenience: log an HTTP request summary */
  request: (method: string, path: string, statusCode: number, durationMs?: number) => {
    const msg = `${method} ${path} → ${statusCode}${durationMs !== undefined ? ` (${durationMs}ms)` : ''}`
    statusCode >= 500 ? log('error', 'http', msg)
      : statusCode >= 400 ? log('warn', 'http', msg)
      : log('info', 'http', msg)
  },
}
