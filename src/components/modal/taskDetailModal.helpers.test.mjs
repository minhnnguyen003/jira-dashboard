import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createLatestRequestScope,
  createTaskDetailState,
  getDescriptionPlaceholder,
  getTaskDetailTransitionView,
  resetTaskDetailStateForIssue,
  resolveTaskDetailStateAfterSave,
  runIssueRefresh,
} from './taskDetailModal.helpers.js';

test('createLatestRequestScope invalidates superseded and disposed requests', () => {
  const scope = createLatestRequestScope();
  const first = scope.begin();
  assert.equal(first.isCurrent(), true);

  const second = scope.begin();
  assert.equal(first.signal.aborted, true);
  assert.equal(first.isCurrent(), false);
  assert.equal(second.isCurrent(), true);

  scope.dispose();
  assert.equal(second.signal.aborted, true);
  assert.equal(second.isCurrent(), false);
});

test('getTaskDetailTransitionView hides state loaded for another issue object with the same key', () => {
  const originalIssue = { key: 'ABC-123' };
  const refreshedIssue = { key: 'ABC-123' };
  const selectedTransition = { id: '31', name: 'Done' };
  const transitionState = {
    loadedFor: originalIssue,
    transitions: [selectedTransition],
    loadError: 'stale error',
    selectedTransition,
    transitionFieldsData: { resolution: { required: true } },
    fieldValues: { resolution: 'Done' },
    transitioning: true,
    actionError: 'stale submit error',
  };

  const currentView = getTaskDetailTransitionView(transitionState, originalIssue);
  assert.equal(currentView.loading, false);
  assert.deepEqual(currentView.transitions, [selectedTransition]);
  assert.equal(currentView.selectedTransition, selectedTransition);

  const refreshedView = getTaskDetailTransitionView(transitionState, refreshedIssue);
  assert.equal(refreshedView.loading, true);
  assert.deepEqual(refreshedView.transitions, []);
  assert.equal(refreshedView.loadError, null);
  assert.equal(refreshedView.selectedTransition, null);
  assert.deepEqual(refreshedView.transitionFieldsData, {});
  assert.deepEqual(refreshedView.fieldValues, {});
  assert.equal(refreshedView.transitioning, false);
  assert.equal(refreshedView.actionError, null);
});

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

test('resolveTaskDetailStateAfterSave commits edited values when refresh returns no issue', () => {
  const issue = {
    key: 'ABC-123',
    fields: {
      summary: 'Before save',
      issuetype: { name: 'Task' },
      customfield_10300: '2026-07-20T09:30:00',
    },
  };
  const state = createTaskDetailState(issue);
  state.editedValues = { summary: 'Saved summary' };
  state.datetimeValues = { ...state.datetimeValues, startDate: '2026-07-22T11:15' };

  const committed = resolveTaskDetailStateAfterSave(state, undefined);

  assert.equal(committed.initialValues.summary, 'Saved summary');
  assert.equal(committed.initialDatetimeValues.startDate, '2026-07-22T11:15');
  assert.deepEqual(committed.editedValues, {});
  assert.deepEqual(committed.datetimeValues, committed.initialDatetimeValues);

  const resetForSameIssue = resetTaskDetailStateForIssue(committed, issue);
  assert.equal(resetForSameIssue.initialValues.summary, 'Saved summary');
  assert.equal(resetForSameIssue.initialDatetimeValues.startDate, '2026-07-22T11:15');
});

test('resetTaskDetailStateForIssue replaces the snapshot when the issue object changes', () => {
  const originalIssue = { key: 'ABC-123', fields: { summary: 'Original', issuetype: { name: 'Task' } } };
  const refreshedIssue = { key: 'ABC-123', fields: { summary: 'Refreshed', issuetype: { name: 'Task' } } };
  const state = createTaskDetailState(originalIssue);

  const reset = resetTaskDetailStateForIssue(state, refreshedIssue);

  assert.equal(reset.initialValues.summary, 'Refreshed');
  assert.equal(reset.sourceIssue, refreshedIssue);
});

test('resolveTaskDetailStateAfterSave uses an actual refreshed issue as the next snapshot', () => {
  const originalIssue = { key: 'ABC-123', fields: { summary: 'Before save', issuetype: { name: 'Task' } } };
  const refreshedIssue = { key: 'ABC-123', fields: { summary: 'From Jira', issuetype: { name: 'Task' } } };
  const state = createTaskDetailState(originalIssue);
  state.editedValues = { summary: 'Local saved summary' };

  const committed = resolveTaskDetailStateAfterSave(state, refreshedIssue);

  assert.equal(committed.initialValues.summary, 'From Jira');
  assert.deepEqual(committed.editedValues, {});
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

test('runIssueRefresh returns null when refresh callback is missing', async () => {
  const issue = { key: 'ABC-123' };

  const result = await runIssueRefresh(issue);

  assert.equal(result, null);
});

test('runIssueRefresh preserves null or void from the refresh callback', async () => {
  const issue = { key: 'ABC-123' };

  assert.equal(await runIssueRefresh(issue, async () => null), null);
  assert.equal(await runIssueRefresh(issue, async () => undefined), null);
});
