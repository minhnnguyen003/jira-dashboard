export const USERS_DIRECTORY_PAGE_SIZE = 100;
export const USERS_DIRECTORY_MAX_PAGES = 100;
export const USERS_DIRECTORY_DEADLINE_MS = 20000;
export const USERS_DIRECTORY_CACHE_TTL_MS = 5 * 60 * 1000;
export const USERS_DIRECTORY_RATE_LIMIT = 10;
export const USERS_DIRECTORY_RATE_LIMIT_WINDOW_MS = 60 * 1000;
export const USERS_DIRECTORY_RATE_LIMIT_MAX_BUCKETS = 1000;

export function isSameOriginUsersRequest(request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return false;
  if (origin) return true;

  const fetchSite = request.headers.get('sec-fetch-site');
  return fetchSite === 'same-origin';
}

export function getUsersRequestClientKey(request) {
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim() || 'unknown';

  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const hops = forwardedFor.split(',').map((hop) => hop.trim()).filter(Boolean);
    return hops.at(-1) || 'unknown';
  }

  return 'unknown';
}

export function createUsersRateLimiter({
  limit,
  windowMs,
  maxBuckets = USERS_DIRECTORY_RATE_LIMIT_MAX_BUCKETS,
  now = Date.now,
}) {
  const buckets = new Map();

  return {
    isAllowed(key) {
      const currentTime = now();
      for (const [bucketKey, bucket] of buckets) {
        if (bucket.resetAt <= currentTime) buckets.delete(bucketKey);
      }

      const existing = buckets.get(key);
      if (!existing || existing.resetAt <= currentTime) {
        while (buckets.size >= maxBuckets) {
          const oldestKey = buckets.keys().next().value;
          buckets.delete(oldestKey);
        }
        buckets.set(key, { count: 1, resetAt: currentTime + windowMs });
        return true;
      }

      if (existing.count >= limit) return false;
      existing.count += 1;
      return true;
    },
  };
}

export function createCachedUsersDirectory({ ttlMs, now = Date.now }) {
  let cachedUsers = null;
  let cachedUntil = 0;
  let inFlight = null;

  return {
    get(fetchUsers) {
      const currentTime = now();
      if (cachedUsers && cachedUntil > currentTime) return Promise.resolve(cachedUsers);
      if (inFlight) return inFlight;

      inFlight = Promise.resolve()
        .then(fetchUsers)
        .then((users) => {
          cachedUsers = users;
          cachedUntil = now() + ttlMs;
          return users;
        })
        .finally(() => {
          inFlight = null;
        });

      return inFlight;
    },
  };
}
