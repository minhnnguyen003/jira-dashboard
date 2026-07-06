import test from 'node:test';
import assert from 'node:assert/strict';

import { getDescriptionPlaceholder, runIssueRefresh } from './taskDetailModal.helpers.js';

test('getDescriptionPlaceholder returns localized placeholder when description is empty', () => {
  assert.equal(getDescriptionPlaceholder('', 'vi'), 'Không có mô tả');
  assert.equal(getDescriptionPlaceholder('   ', 'en'), 'No description');
});

test('getDescriptionPlaceholder returns empty placeholder when description already has content', () => {
  assert.equal(getDescriptionPlaceholder('Has content', 'vi'), '');
});

test('runIssueRefresh calls refresh callback and returns refreshed issue', async () => {
  const issue = { key: 'ABC-123' };
  const refreshedIssue = { key: 'ABC-123', refreshed: true };
  let calledWith = null;

  const result = await runIssueRefresh(issue, async (currentIssue) => {
    calledWith = currentIssue;
    return refreshedIssue;
  });

  assert.deepEqual(calledWith, issue);
  assert.deepEqual(result, refreshedIssue);
});

test('runIssueRefresh returns original issue when refresh callback is missing', async () => {
  const issue = { key: 'ABC-123' };

  const result = await runIssueRefresh(issue);

  assert.deepEqual(result, issue);
});
