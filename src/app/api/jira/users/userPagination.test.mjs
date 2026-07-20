import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchAllJiraUsers, normalizeJiraUsers } from './userPagination.js';

test('fetches every page, normalizes users, and removes duplicate identities', async () => {
  const calls = [];
  const pages = [
    [
      { name: 'minh', displayName: 'Minh', emailAddress: 'minh@etc.vn', avatarUrls: { '48x48': 'minh.png' } },
      { name: 'an', displayName: 'An', emailAddress: 'an@etc.vn' },
    ],
    [
      { name: 'AN-OLD', displayName: 'An duplicate', emailAddress: 'AN@ETC.VN' },
      { name: 'binh' },
    ],
    [],
  ];
  const users = await fetchAllJiraUsers(async ({ startAt, maxResults }) => {
    calls.push({ startAt, maxResults });
    return pages.shift();
  }, 2);

  assert.deepEqual(calls, [
    { startAt: 0, maxResults: 2 },
    { startAt: 2, maxResults: 2 },
    { startAt: 4, maxResults: 2 },
  ]);
  assert.deepEqual(users, [
    { name: 'minh', displayName: 'Minh', email: 'minh@etc.vn', avatarUrl: 'minh.png' },
    { name: 'an', displayName: 'An', email: 'an@etc.vn', avatarUrl: '' },
    { name: 'binh', displayName: 'binh', email: 'binh', avatarUrl: '' },
  ]);
});

test('rejects a non-array Jira response instead of returning a partial list', async () => {
  await assert.rejects(
    () => fetchAllJiraUsers(async () => ({ error: 'bad response' }), 100),
    /Expected Jira users page to be an array/,
  );
});

test('continues after a short Jira page because the server may cap maxResults', async () => {
  const calls = [];
  const pages = [[{ name: 'minh' }], [{ name: 'an' }], []];

  const users = await fetchAllJiraUsers(async ({ startAt, maxResults }) => {
    calls.push({ startAt, maxResults });
    return pages.shift();
  }, 2);

  assert.deepEqual(calls, [
    { startAt: 0, maxResults: 2 },
    { startAt: 1, maxResults: 2 },
    { startAt: 2, maxResults: 2 },
  ]);
  assert.deepEqual(users.map((user) => user.name), ['minh', 'an']);
});

test('accepts consecutive identical raw pages, then dedupes when later data arrives', async () => {
  const pages = [[{ name: 'minh' }], [{ name: 'minh' }], [{ name: 'an' }], []];

  const users = await fetchAllJiraUsers(async () => pages.shift(), 1, 5);

  assert.deepEqual(users.map((user) => user.name), ['minh', 'an']);
});

test('allows exactly maxPages data pages followed by one empty termination page', async () => {
  let calls = 0;
  const pages = [[{ name: 'minh' }], [{ name: 'an' }], []];

  const users = await fetchAllJiraUsers(async () => {
    calls += 1;
    return pages.shift();
  }, 1, 2);

  assert.equal(calls, 3);
  assert.deepEqual(users.map((user) => user.name), ['minh', 'an']);
});

test('rejects a non-empty data page after maxPages instead of returning a partial list', async () => {
  let calls = 0;
  const pages = [[{ name: 'minh' }], [{ name: 'an' }], [{ name: 'binh' }]];

  await assert.rejects(
    () => fetchAllJiraUsers(async () => {
      calls += 1;
      return pages.shift();
    }, 1, 2),
    /exceeded the maximum of 2 Jira users pages/,
  );

  assert.equal(calls, 3);
});

test('rejects a non-finite page cap so callers cannot disable the safety limit', async () => {
  await assert.rejects(
    () => fetchAllJiraUsers(async () => [], 1, Infinity),
    /maxPages must be a positive integer/,
  );
});

test('passes an abort signal through every Jira page request', async () => {
  const signal = AbortSignal.timeout(1000);
  const seenSignals = [];
  const pages = [[{ name: 'minh' }], []];

  await fetchAllJiraUsers(async ({ signal: pageSignal }) => {
    seenSignals.push(pageSignal);
    return pages.shift();
  }, 1, 2, { signal });

  assert.deepEqual(seenSignals, [signal, signal]);
});

test('normalizes a malformed avatar URL to an empty string', () => {
  assert.deepEqual(
    normalizeJiraUsers([{ name: 'minh', avatarUrls: { '48x48': { href: 'minh.png' } } }]),
    [{ name: 'minh', displayName: 'minh', email: 'minh', avatarUrl: '' }],
  );
});
