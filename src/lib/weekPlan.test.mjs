import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatDateForInput,
  getCurrentWeekRange,
  groupWeekPlanTasks,
  isInProgressTaskOverdue,
  WEEK_PLAN_COLUMNS,
} from './weekPlan.js';

test('getCurrentWeekRange returns Monday to Sunday of current week', () => {
  const { start, end } = getCurrentWeekRange(new Date('2026-08-05T12:00:00Z'));

  assert.equal(formatDateForInput(start), '2026-08-03');
  assert.equal(formatDateForInput(end), '2026-08-09');
});

test('groupWeekPlanTasks puts only overdue Open tasks in the Overdue column', () => {
  const tasks = [
    { key: 'ABC-1', summary: 'Task open', status: 'Open', dueDate: '2026-08-06 10:00' },
    { key: 'ABC-2', summary: 'Task in progress', status: 'In Progress', dueDate: '2026-08-02 10:00' },
    { key: 'ABC-3', summary: 'Task resolved', status: 'Resolved', dueDate: '2026-08-08 10:00' },
    { key: 'ABC-4', summary: 'Task pending', status: 'Pending', dueDate: '2026-08-04 10:00' },
    { key: 'ABC-5', summary: 'Task cancelled', status: 'Cancelled', dueDate: '2026-08-04 10:00' },
    { key: 'ABC-6', summary: 'Task overdue', status: 'Open', dueDate: '2026-08-02 10:00' },
  ];

  const grouped = groupWeekPlanTasks(tasks, new Date('2026-08-05T12:00:00Z'));

  assert.equal(WEEK_PLAN_COLUMNS[0], 'Overdue');
  assert.deepEqual(grouped.Overdue.map((task) => task.key), ['ABC-6']);
  assert.deepEqual(grouped.Open.map((task) => task.key), ['ABC-1']);
  assert.deepEqual(grouped['In Progress'].map((task) => task.key), ['ABC-2']);
  assert.equal(grouped['Closed / Resolved'].length, 1);
  assert.equal(grouped['Pending'].length, 1);
  assert.equal(grouped['Cancelled'].length, 1);
});

test('isInProgressTaskOverdue only flags expired In Progress tasks', () => {
  const now = new Date('2026-08-05T12:00:00');

  assert.equal(isInProgressTaskOverdue({ status: 'In Progress', dueDate: '2026-08-05 11:00' }, now), true);
  assert.equal(isInProgressTaskOverdue({ status: 'Open', dueDate: '2026-08-05 11:00' }, now), false);
  assert.equal(isInProgressTaskOverdue({ status: 'In Progress', dueDate: '2026-08-05 13:00' }, now), false);
});
