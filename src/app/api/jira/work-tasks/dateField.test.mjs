import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DATE_FIELD_OPTIONS,
  buildDateClauses,
  getDateFieldConfig,
  normalizeDateField,
} from './dateField.js';

test('normalizeDateField defaults to startDate', () => {
  assert.equal(normalizeDateField(null), 'startDate');
  assert.equal(normalizeDateField(''), 'startDate');
  assert.equal(normalizeDateField('unknown'), 'startDate');
});

test('normalizeDateField keeps supported values', () => {
  assert.equal(normalizeDateField('startDate'), 'startDate');
  assert.equal(normalizeDateField('created'), 'created');
  assert.equal(normalizeDateField('updated'), 'updated');
  assert.equal(normalizeDateField('endDate'), 'endDate');
});

test('getDateFieldConfig maps date fields to jira columns', () => {
  assert.deepEqual(getDateFieldConfig('startDate'), {
    value: 'startDate',
    label: 'Start Date',
    jqlField: 'cf[10300]',
    orderBy: 'cf[10300]',
  });
  assert.deepEqual(getDateFieldConfig('updated'), {
    value: 'updated',
    label: 'Lasted Update',
    jqlField: 'updated',
    orderBy: 'updated',
  });
});

test('buildDateClauses builds start date filters and matching order by', () => {
  const result = buildDateClauses({
    from: '2026-07-01',
    to: '2026-07-31',
    dateField: 'startDate',
  });

  assert.deepEqual(result.clauses, [
    'cf[10300] >= "2026-07-01 00:00"',
    'cf[10300] <= "2026-07-31 23:59"',
  ]);
  assert.equal(result.orderBy, 'cf[10300] DESC');
});

test('buildDateClauses builds created-date filters when selected', () => {
  const result = buildDateClauses({
    from: '2026-07-01',
    to: null,
    dateField: 'created',
  });

  assert.deepEqual(result.clauses, [
    'created >= "2026-07-01 00:00"',
  ]);
  assert.equal(result.orderBy, 'created DESC');
});

test('date field options expose fixed dropdown values in the intended order', () => {
  assert.deepEqual(
    DATE_FIELD_OPTIONS.map((option) => option.value),
    ['startDate', 'created', 'updated', 'endDate'],
  );
});
