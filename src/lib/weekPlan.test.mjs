import test from 'node:test';
import assert from 'node:assert/strict';

import { formatDateForInput, getCurrentWeekRange, groupWeekPlanTasks } from './weekPlan.js';

test('getCurrentWeekRange returns Monday to Sunday of current week', () => {
  const { start, end } = getCurrentWeekRange(new Date('2026-08-05T12:00:00Z'));

  assert.equal(formatDateForInput(start), '2026-08-03');
  assert.equal(formatDateForInput(end), '2026-08-09');
});

test('groupWeekPlanTasks maps overdue items into a special column', () => {
  const tasks = [
    { key: 'ABC-1', summary: 'Task open', status: 'Open', dueDate: '2026-08-06 10:00' },
    { key: 'ABC-2', summary: 'Task in progress', status: 'In Progress', dueDate: '2026-08-07 10:00' },
    { key: 'ABC-3', summary: 'Task resolved', status: 'Resolved', dueDate: '2026-08-08 10:00' },
    { key: 'ABC-4', summary: 'Task pending', status: 'Pending', dueDate: '2026-08-04 10:00' },
    { key: 'ABC-5', summary: 'Task cancelled', status: 'Cancelled', dueDate: '2026-08-04 10:00' },
    { key: 'ABC-6', summary: 'Task overdue', status: 'Open', dueDate: '2026-08-02 10:00' },
  ];

  const grouped = groupWeekPlanTasks(tasks, new Date('2026-08-05T12:00:00Z'));

  assert.equal(grouped['Open'].length, 1);
  assert.equal(grouped['In Progress'].length, 1);
  assert.equal(grouped['Closed / Resolved'].length, 1);
  assert.equal(grouped['Pending'].length, 1);
  assert.equal(grouped['Cancelled'].length, 1);
  assert.equal(grouped.Overdue.length, 1);
});
