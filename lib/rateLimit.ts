// lib/rateLimit.ts
// In-memory sliding window rate limiter. Sufficient for hackathon scale and
// single-instance Railway deploys. Replace with Redis if scaling out.

interface Bucket {
  hits: number[];
}

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 5_000;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

export function rateLimit(key: string, max: number, windowSec: number): RateLimitResult {
  const now = Date.now();
  const cutoff = now - windowSec * 1000;

  let bucket = buckets.get(key);
  if (!bucket) {
    if (buckets.size > MAX_BUCKETS) {
      // Naive eviction: drop oldest random key
      const k = buckets.keys().next().value;
      if (k) buckets.delete(k);
    }
    bucket = { hits: [] };
    buckets.set(key, bucket);
  }

  bucket.hits = bucket.hits.filter(t => t > cutoff);

  if (bucket.hits.length >= max) {
    const oldest = bucket.hits[0];
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((oldest + windowSec * 1000 - now) / 1000)),
    };
  }

  bucket.hits.push(now);
  return { allowed: true, remaining: max - bucket.hits.length, retryAfterSec: 0 };
}
