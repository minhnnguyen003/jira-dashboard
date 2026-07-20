import test from 'node:test';
import assert from 'node:assert/strict';

import { createTaskDetailState, getDescriptionPlaceholder, runIssueRefresh } from './taskDetailModal.helpers.js';

test('createTaskDetailState snapshots editable values and datetime inputs from the issue', () => {
  const issue = {
    key: 'ABC-123',
    fields: {
      summary: 'Original summary',
      priority: { name: 'High' },
      assignee: { displayName: 'Alice' },
      reporter: null,
      sprint: { name: 'Sprint 7' },
      timeoriginalestimate: '90000',
      timeestimate: '5400',
      timespent: null,
      customfield_10300: '2026-07-20T09:30:00',
      customfield_10302: '2026-07-21T17:45:00',
      resolutiondate: null,
      description: 'Original description',
      epic: { key: 'EPIC-1' },
      parent: { key: 'PARENT-1' },
      labels: ['frontend', 'urgent'],
      resolution: null,
      issuetype: { name: 'Task' },
    },
  };

  const state = createTaskDetailState(issue);

  assert.deepEqual(state.initialValues, {
    summary: 'Original summary',
    priority: 'High',
    assignee: 'Alice',
    reporter: '',
    sprint: 'Sprint 7',
    timeoriginalestimate: '1d 1h',
    timeestimate: '1h 30m',
    timespent: '0h',
    startDate: '20/07/2026 09:30',
    dueDate: '21/07/2026 17:45',
    resolutionDate: '-',
    description: 'Original description',
    epic: 'EPIC-1',
    parent: 'PARENT-1',
    labels: 'frontend, urgent',
    resolution: '',
    issuetype: 'Task',
  });
  assert.deepEqual(state.initialDatetimeValues, {
    startDate: '2026-07-20T09:30',
    dueDate: '2026-07-21T17:45',
    resolutionDate: '',
  });
  assert.deepEqual(state.editedValues, {});
  assert.deepEqual(state.datetimeValues, state.initialDatetimeValues);

  issue.fields.summary = 'Mutated after snapshot';
  issue.fields.labels.push('later');
  assert.equal(state.initialValues.summary, 'Original summary');
  assert.equal(state.initialValues.labels, 'frontend, urgent');
});

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
