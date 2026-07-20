import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCachedUsersDirectory,
  createUsersRateLimiter,
  getUsersRequestClientKey,
  isSameOriginUsersRequest,
  USERS_DIRECTORY_MAX_PAGES,
  USERS_DIRECTORY_PAGE_SIZE,
} from './usersRequestGuards.js';

test('accepts same-origin users requests and rejects cross-site fetches', () => {
  const sameOrigin = new Request('https://jira.local/api/jira/users?all=true', {
    headers: { 'sec-fetch-site': 'same-origin' },
  });
  const crossSite = new Request('https://jira.local/api/jira/users?all=true', {
    headers: { 'sec-fetch-site': 'cross-site' },
  });

  assert.equal(isSameOriginUsersRequest(sameOrigin), true);
  assert.equal(isSameOriginUsersRequest(crossSite), false);
});

test('rejects an origin header from another site', () => {
  const request = new Request('https://jira.local/api/jira/users?all=true', {
    headers: { origin: 'https://example.com' },
  });

  assert.equal(isSameOriginUsersRequest(request), false);
});

test('rejects full-directory requests that do not carry browser same-origin evidence', () => {
  const request = new Request('https://jira.local/api/jira/users?all=true');

  assert.equal(isSameOriginUsersRequest(request), false);
});

test('uses a bounded default page cap for full directory loads', () => {
  assert.equal(USERS_DIRECTORY_PAGE_SIZE, 100);
  assert.equal(USERS_DIRECTORY_MAX_PAGES <= 100, true);
});

test('derives rate limit key from trusted forwarded client address', () => {
  const request = new Request('https://jira.local/api/jira/users', {
    headers: { 'x-forwarded-for': '203.0.113.1, 10.0.0.2' },
  });

  assert.equal(getUsersRequestClientKey(request), '10.0.0.2');
});

test('prefers x-real-ip over spoofable forwarded chains', () => {
  const request = new Request('https://jira.local/api/jira/users', {
    headers: {
      'x-real-ip': '198.51.100.10',
      'x-forwarded-for': 'spoofed-a, spoofed-b',
    },
  });

  assert.equal(getUsersRequestClientKey(request), '198.51.100.10');
});

test('uses the appended forwarded hop so spoofed leftmost values do not rotate buckets', () => {
  const limiter = createUsersRateLimiter({ limit: 1, windowMs: 1000 });
  const first = getUsersRequestClientKey(new Request('https://jira.local/api/jira/users', {
    headers: { 'x-forwarded-for': 'spoofed-a, 198.51.100.10' },
  }));
  const second = getUsersRequestClientKey(new Request('https://jira.local/api/jira/users', {
    headers: { 'x-forwarded-for': 'spoofed-b, 198.51.100.10' },
  }));

  assert.equal(first, second);
  assert.equal(limiter.isAllowed(first), true);
  assert.equal(limiter.isAllowed(second), false);
});

test('rate limiter blocks after the configured request budget then resets by window', () => {
  let now = 1000;
  const limiter = createUsersRateLimiter({ limit: 2, windowMs: 100, now: () => now });

  assert.equal(limiter.isAllowed('client-a'), true);
  assert.equal(limiter.isAllowed('client-a'), true);
  assert.equal(limiter.isAllowed('client-a'), false);
  now += 101;
  assert.equal(limiter.isAllowed('client-a'), true);
});

test('rate limiter keeps a bounded bucket set when many keys arrive', () => {
  const limiter = createUsersRateLimiter({
    limit: 1,
    windowMs: 1000,
    maxBuckets: 2,
  });

  assert.equal(limiter.isAllowed('client-a'), true);
  assert.equal(limiter.isAllowed('client-b'), true);
  assert.equal(limiter.isAllowed('client-c'), true);
  assert.equal(limiter.isAllowed('client-a'), true);
});

test('directory cache shares in-flight request and refreshes after ttl', async () => {
  let now = 1000;
  let fetchCount = 0;
  const cache = createCachedUsersDirectory({
    ttlMs: 50,
    now: () => now,
  });
  const fetchUsers = async () => {
    fetchCount += 1;
    return [{ name: `user-${fetchCount}` }];
  };

  const first = cache.get(fetchUsers);
  const concurrent = cache.get(fetchUsers);
  assert.strictEqual(first, concurrent);
  assert.deepEqual(await first, [{ name: 'user-1' }]);

  assert.deepEqual(await cache.get(fetchUsers), [{ name: 'user-1' }]);
  now += 51;
  assert.deepEqual(await cache.get(fetchUsers), [{ name: 'user-2' }]);
  assert.equal(fetchCount, 2);
});
