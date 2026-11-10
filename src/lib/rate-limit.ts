/**
 * Lightweight server-side sliding-window rate limiter and trusted client IP extractor
 * for public Next.js Server Actions.
 */

interface RateLimitBucket {
    timestamps: number[];
}

const buckets = new Map<string, RateLimitBucket>();
const MAX_BUCKETS = 10_000;

/**
 * Extracts the client IP address from request headers, prioritizing platform-verified
 * proxy headers (`x-vercel-forwarded-for`, `cf-connecting-ip`) ahead of generic headers.
 */
export function extractClientIp(headersList: { get(name: string): string | null }): string {
    const rawIp =
        headersList.get('x-vercel-forwarded-for') ||
        headersList.get('cf-connecting-ip') ||
        headersList.get('x-real-ip') ||
        headersList.get('x-forwarded-for') ||
        'unknown';

    const firstHop = rawIp.split(',')[0]?.trim() || 'unknown';
    // Strip optional IPv4 port suffix if present (e.g. "203.0.113.5:54321")
    const ipv4WithPort = firstHop.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/);
    return ipv4WithPort ? ipv4WithPort[1] : firstHop;
}

/**
 * Checks and records an action invocation under a sliding time window.
 * Returns `{ allowed: true, remaining }` or `{ allowed: false, retryAfterSeconds }`.
 */
export function checkRateLimit(
    namespace: string,
    identifier: string,
    maxRequests: number,
    windowMs: number
): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
    const now = Date.now();
    const key = `${namespace}:${identifier || 'unknown'}`;
    const cutoff = now - windowMs;

    // Periodic pruning to bound memory in long-lived Node processes
    if (buckets.size > MAX_BUCKETS) {
        for (const [k, b] of buckets.entries()) {
            const active = b.timestamps.filter((t) => t > cutoff);
            if (active.length === 0) {
                buckets.delete(k);
            } else {
                b.timestamps = active;
            }
        }
    }

    const existing = buckets.get(key);
    const activeTimestamps = existing ? existing.timestamps.filter((t) => t > cutoff) : [];

    if (activeTimestamps.length >= maxRequests) {
        const oldestInWindow = activeTimestamps[0] || now;
        const retryAfterSeconds = Math.max(1, Math.ceil((oldestInWindow + windowMs - now) / 1000));
        buckets.set(key, { timestamps: activeTimestamps });
        return {
            allowed: false,
            remaining: 0,
            retryAfterSeconds,
        };
    }

    activeTimestamps.push(now);
    buckets.set(key, { timestamps: activeTimestamps });

    return {
        allowed: true,
        remaining: Math.max(0, maxRequests - activeTimestamps.length),
        retryAfterSeconds: 0,
    };
}

/**
 * Clears in-memory rate limit buckets (intended for isolated unit tests).
 */
export function resetRateLimitBuckets(): void {
    buckets.clear();
}
