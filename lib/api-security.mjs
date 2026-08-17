/**
 * Shared defensive controls for public API routes.
 *
 * This project intentionally has no database. The cache and rate limiter are therefore
 * process-local best-effort controls. They protect a running instance from accidental
 * abuse and provider amplification; production multi-instance deployments should move
 * these controls to an edge/CDN or a shared store if traffic becomes significant.
 */

const SYMBOL_PATTERN = /^[A-Z0-9^._=&-]{1,24}$/;
const MAX_CACHE_ENTRIES = 500;
const RATE_LIMIT_WINDOW_MS = 60_000;
const rateBuckets = new Map();

/** Validate and normalize a Yahoo Finance symbol. */
export function normalizeSymbol(value) {
  const symbol = String(value ?? "").trim().toUpperCase();
  return SYMBOL_PATTERN.test(symbol) ? symbol : null;
}

/** Return a stable client key without trusting forwarded headers as an identity boundary. */
export function getClientKey(request) {
  // On platforms that provide a trusted request IP, x-real-ip is preferable to an
  // arbitrary multi-value x-forwarded-for chain. This is only a best-effort limiter.
  return request.headers.get("x-real-ip")?.trim() || "anonymous";
}

/**
 * Simple fixed-window limiter. Returns null when allowed or a retry-after value in seconds.
 */
export function rateLimit(request, bucket, limit) {
  const now = Date.now();
  const key = `${bucket}:${getClientKey(request)}`;
  const existing = rateBuckets.get(key);

  if (!existing || now >= existing.resetAt) {
    rateBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    pruneRateBuckets(now);
    return null;
  }

  if (existing.count >= limit) {
    return Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
  }

  existing.count += 1;
  return null;
}

function pruneRateBuckets(now) {
  // Keep the in-memory limiter bounded even if a large number of clients connect.
  if (rateBuckets.size < 1000) return;
  for (const [key, value] of rateBuckets) {
    if (value.resetAt <= now) rateBuckets.delete(key);
  }
}

/** Create a small bounded TTL cache suitable for serverless/process-local use. */
export function createTtlCache(maxEntries = MAX_CACHE_ENTRIES) {
  const store = new Map();

  return {
    get(key, ttlMs) {
      const item = store.get(key);
      if (!item) return null;
      if (Date.now() - item.time >= ttlMs) {
        store.delete(key);
        return null;
      }
      // Refresh insertion order so frequently used keys survive eviction.
      store.delete(key);
      store.set(key, item);
      return item.data;
    },
    set(key, data) {
      store.delete(key);
      store.set(key, { time: Date.now(), data });
      while (store.size > maxEntries) store.delete(store.keys().next().value);
    }
  };
}

/** Standard API error response. Avoid exposing provider/library internals to clients. */
export function apiError(NextResponse, message, status, retryAfter) {
  const headers = { "Cache-Control": "no-store" };
  if (retryAfter) headers["Retry-After"] = String(retryAfter);
  return NextResponse.json({ error: message }, { status, headers });
}
