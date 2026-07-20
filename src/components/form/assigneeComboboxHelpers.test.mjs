import test from 'node:test';
import assert from 'node:assert/strict';
import * as helpers from './assigneeComboboxHelpers.js';

const { filterAssigneeUsers, resolveAssigneeInput } = helpers;

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

test('syncs the selected display name when users populate asynchronously for the same value', () => {
  assert.equal(typeof helpers.createAssigneeInputSnapshot, 'function');
  assert.equal(typeof helpers.createAssigneeInputState, 'function');
  assert.equal(typeof helpers.reconcileAssigneeInputState, 'function');

  const emptySnapshot = helpers.createAssigneeInputSnapshot(users[0].email, null);
  const initialState = helpers.createAssigneeInputState(emptySnapshot);
  const populatedSnapshot = helpers.createAssigneeInputSnapshot(users[0].email, users[0]);
  const populatedState = helpers.reconcileAssigneeInputState(initialState, populatedSnapshot);

  assert.equal(initialState.query, '');
  assert.equal(populatedState.query, users[0].displayName);
  assert.deepEqual(populatedState.snapshot, populatedSnapshot);
});

test('does not revive an old edit when the external selection changes A to B to A', () => {
  assert.equal(typeof helpers.editAssigneeInputState, 'function');

  const snapshotA = helpers.createAssigneeInputSnapshot(users[0].email, users[0]);
  const snapshotB = helpers.createAssigneeInputSnapshot(users[1].email, users[1]);
  let state = helpers.createAssigneeInputState(snapshotA);
  state = helpers.editAssigneeInputState(snapshotA, 'old draft for A');
  state = helpers.reconcileAssigneeInputState(state, snapshotB);
  state = helpers.reconcileAssigneeInputState(state, snapshotA);

  assert.equal(state.query, users[0].displayName);
});

test('keeps an optimistic choice stable across the batched controlled-value commit', () => {
  assert.equal(typeof helpers.chooseAssigneeInputState, 'function');

  const chosenState = helpers.chooseAssigneeInputState(users[1]);
  const committedSnapshot = helpers.createAssigneeInputSnapshot(users[1].email, users[1]);

  assert.strictEqual(helpers.reconcileAssigneeInputState(chosenState, committedSnapshot), chosenState);
  assert.equal(chosenState.query, users[1].displayName);
});

test('rejects stale blur generations after an external commit or newer interaction', () => {
  assert.equal(typeof helpers.isAssigneeBlurGenerationCurrent, 'function');
  assert.equal(typeof helpers.runAssigneeBlurIfCurrent, 'function');
  let applied = 0;

  assert.equal(helpers.isAssigneeBlurGenerationCurrent(1, 2), false);
  assert.equal(helpers.isAssigneeBlurGenerationCurrent(2, 2), true);
  assert.equal(helpers.runAssigneeBlurIfCurrent(1, 2, () => { applied += 1; }), false);
  assert.equal(applied, 0);
  assert.equal(helpers.runAssigneeBlurIfCurrent(2, 2, () => { applied += 1; }), true);
  assert.equal(applied, 1);
});
