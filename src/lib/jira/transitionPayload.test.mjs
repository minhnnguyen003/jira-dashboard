import test from 'node:test';
import assert from 'node:assert/strict';

import { buildTransitionFields, normalizeRemainingEstimateValue, sanitizeTransitionFields } from './transitionPayload.js';

test('buildTransitionFields maps timetracking to remainingEstimate instead of seconds payload', () => {
  const fields = buildTransitionFields(
    {
      timetracking: {
        required: true,
        schema: { type: 'any' },
        name: 'Time Tracking',
        fieldId: 'timetracking',
        operations: ['set'],
      },
    },
    {
      timetracking: '1d 2h 30m',
    },
    {
      timeestimate: '28800',
    }
  );

  assert.deepEqual(fields, {
    timetracking: {
      remainingEstimate: '1d 2h 30m',
    },
  });
});

test('buildTransitionFields falls back to current estimate when transition requires timetracking and user leaves it blank', () => {
  const fields = buildTransitionFields(
    {
      timetracking: {
        required: true,
        schema: { type: 'any' },
        name: 'Time Tracking',
        fieldId: 'timetracking',
        operations: ['set'],
      },
    },
    {
      timetracking: '',
    },
    {
      timeestimate: '28800',
    }
  );

  assert.deepEqual(fields, {
    timetracking: {
      remainingEstimate: '8h',
    },
  });
});

test('normalizeRemainingEstimateValue converts seconds into Jira estimate syntax', () => {
  assert.equal(normalizeRemainingEstimateValue('28800'), '8h');
  assert.equal(normalizeRemainingEstimateValue('90000'), '1d 1h');
  assert.equal(normalizeRemainingEstimateValue('5400'), '1h 30m');
});

test('sanitizeTransitionFields removes empty nested values and empty top-level fields', () => {
  const fields = sanitizeTransitionFields({
    customfield_10304: '',
    timetracking: {
      remainingEstimate: '8h',
      originalEstimate: '',
    },
    resolution: {
      id: '1',
    },
  });

  assert.deepEqual(fields, {
    timetracking: {
      remainingEstimate: '8h',
    },
    resolution: {
      id: '1',
    },
  });
});
