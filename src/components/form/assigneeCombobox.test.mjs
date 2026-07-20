import test from 'node:test';
import assert from 'node:assert/strict';
import { filterAssigneeUsers, resolveAssigneeInput } from './assigneeCombobox.js';

const users = [
  { name: 'minh.nguyen', displayName: 'Minh Nguyễn', email: 'minh@etc.vn' },
  { name: 'an.tran', displayName: 'An Trần', email: 'an@etc.vn' },
];

test('filters locally across display name, username, and email without case sensitivity', () => {
  assert.deepEqual(filterAssigneeUsers(users, '  NGUYỄN '), [users[0]]);
  assert.deepEqual(filterAssigneeUsers(users, 'AN.TR'), [users[1]]);
  assert.deepEqual(filterAssigneeUsers(users, '@ETC.VN'), users);
});

test('resolves exact username or email on blur', () => {
  assert.equal(resolveAssigneeInput(users, ' MINH.NGUYEN '), users[0]);
  assert.equal(resolveAssigneeInput(users, 'AN@ETC.VN'), users[1]);
});

test('falls back to All for partial, unknown, or empty input', () => {
  assert.equal(resolveAssigneeInput(users, 'minh'), null);
  assert.equal(resolveAssigneeInput(users, 'unknown'), null);
  assert.equal(resolveAssigneeInput(users, '  '), null);
});
