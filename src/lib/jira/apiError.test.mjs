import test from 'node:test';
import assert from 'node:assert/strict';
import { getJiraErrorDetails } from './apiError.js';

test('extracts status and detail from an Axios-shaped error', () => {
  const error = { isAxiosError: true, response: { status: 403, data: { message: 'Forbidden' } }, message: 'fallback' };
  assert.deepEqual(getJiraErrorDetails(error), { status: 403, detail: { message: 'Forbidden' } });
});

test('falls back to Error message and UNKNOWN status', () => {
  assert.deepEqual(getJiraErrorDetails(new Error('boom')), { status: 'UNKNOWN', detail: 'boom' });
});

test('handles non-Error thrown values', () => {
  assert.deepEqual(getJiraErrorDetails('boom'), { status: 'UNKNOWN', detail: 'boom' });
});
