// src/lib/jira/personalJql.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPersonalJql } from './personalJql.js';

test('includes assignee email quoted', () => {
  const jql = buildPersonalJql('user@example.com', 2026, 7);
  assert.match(jql, /assignee = "user@example\.com"/);
});

test('formats startOfMonth as first day 00:00', () => {
  const jql = buildPersonalJql('user@example.com', 2026, 7);
  assert.match(jql, /"Start Date \(Time\)" >= "2026-07-01 00:00"/);
});

test('formats endOfMonth as last day 23:59 — July has 31 days', () => {
  const jql = buildPersonalJql('user@example.com', 2026, 7);
  assert.match(jql, /"Due Date \(Time\)" <= "2026-07-31 23:59"/);
});

test('handles February in leap year correctly', () => {
  const jql = buildPersonalJql('user@example.com', 2024, 2);
  assert.match(jql, /"Due Date \(Time\)" <= "2024-02-29 23:59"/);
});

test('handles February in non-leap year correctly', () => {
  const jql = buildPersonalJql('user@example.com', 2026, 2);
  assert.match(jql, /"Due Date \(Time\)" <= "2026-02-28 23:59"/);
});

test('includes labels and originalEstimate filters', () => {
  const jql = buildPersonalJql('user@example.com', 2026, 7);
  assert.match(jql, /labels NOT IN \(hashsubtask\)/);
  assert.match(jql, /originalEstimate IS NOT EMPTY/);
});

test('includes OR clause for tasks with empty start/due dates', () => {
  const jql = buildPersonalJql('user@example.com', 2026, 7);
  assert.match(jql, /"Start Date \(Time\)" IS EMPTY/);
  assert.match(jql, /"Due Date \(Time\)" IS EMPTY/);
});

test('zero-pads single-digit month', () => {
  const jql = buildPersonalJql('user@example.com', 2026, 3);
  assert.match(jql, /2026-03-01/);
});
