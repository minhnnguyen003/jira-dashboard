import test from 'node:test';
import assert from 'node:assert/strict';
import { consumeBrowseUsers, createBrowseUsersLoader } from './browseUsersLoader.js';

const users = [
  { name: 'an', displayName: 'An Nguyen', email: 'an@example.com' },
];

test('shares one in-flight users request and result between concurrent consumers', async () => {
  let fetchCount = 0;
  const loadUsers = createBrowseUsersLoader(async () => {
    fetchCount += 1;
    return users;
  });

  const first = loadUsers();
  const second = loadUsers();

  assert.strictEqual(first, second);
  const [firstResult, secondResult] = await Promise.all([first, second]);
  assert.strictEqual(firstResult, users);
  assert.strictEqual(secondResult, users);
  assert.equal(fetchCount, 1);
});

test('clears a rejected users request so a later mount can retry', async () => {
  let fetchCount = 0;
  const failure = new Error('users unavailable');
  const loadUsers = createBrowseUsersLoader(async () => {
    fetchCount += 1;
    if (fetchCount === 1) throw failure;
    return users;
  });

  const first = loadUsers();
  const concurrent = loadUsers();
  assert.strictEqual(first, concurrent);
  await Promise.all([
    assert.rejects(first, failure),
    assert.rejects(concurrent, failure),
  ]);

  const retry = loadUsers();
  assert.notStrictEqual(retry, first);
  assert.strictEqual(await retry, users);
  assert.equal(fetchCount, 2);
});

test('does not apply success, error, or settled state after a consumer becomes inactive', async () => {
  let active = true;
  const applied = [];
  let resolveUsers;
  let rejectUsers;
  const pendingSuccess = new Promise((resolve) => { resolveUsers = resolve; });
  const pendingFailure = new Promise((_, reject) => { rejectUsers = reject; });
  const handlers = {
    onSuccess: () => applied.push('success'),
    onError: () => applied.push('error'),
    onSettled: () => applied.push('settled'),
  };

  const successConsumer = consumeBrowseUsers(pendingSuccess, () => active, handlers);
  const failureConsumer = consumeBrowseUsers(pendingFailure, () => active, handlers);
  active = false;
  resolveUsers(users);
  rejectUsers(new Error('users unavailable'));

  await Promise.all([successConsumer, failureConsumer]);
  assert.deepEqual(applied, []);
});
