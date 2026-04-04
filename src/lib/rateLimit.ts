const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

/**
 * Simple in-memory rate limiter.
 * @param key     Unique identifier (e.g. IP + route)
 * @param limit   Max requests allowed in the window
 * @param windowMs Time window in milliseconds
 * @returns true if request is allowed, false if rate limited
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(key)

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (entry.count >= limit) return false

  entry.count++
  return true
}