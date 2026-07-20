import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchAllJiraUsers } from './userPagination.js';

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
