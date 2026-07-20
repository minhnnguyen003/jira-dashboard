import test from 'node:test';
import assert from 'node:assert/strict';
import { formatJiraErrorDetail, getJiraErrorDetails } from './apiError.js';

test('extracts status and detail from an Axios-shaped error', () => {
  const error = { isAxiosError: true, response: { status: 403, data: { message: 'Forbidden' } }, message: 'fallback' };
  assert.deepEqual(getJiraErrorDetails(error), { status: 403, detail: { message: 'Forbidden' } });
});

test('falls back to the Axios message when no response is available', () => {
  assert.deepEqual(
    getJiraErrorDetails({ isAxiosError: true, code: 'ECONNRESET', message: 'socket closed' }),
    { status: 'ECONNRESET', detail: 'socket closed' },
  );
  assert.deepEqual(
    getJiraErrorDetails({ isAxiosError: true, code: 'ECONNRESET', message: '' }),
    { status: 'ECONNRESET', detail: 'Unknown error' },
  );
});

test('falls back from falsy Axios response payloads to the error message', () => {
  for (const data of ['', false, 0, null, undefined]) {
    assert.deepEqual(
      getJiraErrorDetails({ isAxiosError: true, response: { status: 502, data }, message: 'upstream failed' }),
      { status: 502, detail: 'upstream failed' },
    );
  }
});

test('falls back to Error message and UNKNOWN status', () => {
  assert.deepEqual(getJiraErrorDetails(new Error('boom')), { status: 'UNKNOWN', detail: 'boom' });
});

test('handles non-Error thrown values', () => {
  assert.deepEqual(getJiraErrorDetails('boom'), { status: 'UNKNOWN', detail: 'boom' });
});

test('formats Jira error fields only after narrowing their runtime types', () => {
  assert.equal(
    formatJiraErrorDetail({ errors: { summary: { reason: 'Required' }, retryAfter: 0 } }),
    'summary: {"reason":"Required"} | retryAfter: 0',
  );
  assert.equal(formatJiraErrorDetail({ errorMessages: ['First', 'Second'] }), 'First, Second');
  assert.equal(
    formatJiraErrorDetail({ errorMessages: 'not-an-array', message: 'Fallback message' }),
    'Fallback message',
  );
  assert.equal(
    formatJiraErrorDetail({ errorMessages: null, message: { text: 'not-a-string' } }),
    '{"errorMessages":null,"message":{"text":"not-a-string"}}',
  );
});

test('formats circular and hostile Jira details without throwing', () => {
  const circular = {};
  circular.self = circular;
  assert.equal(formatJiraErrorDetail({ errors: { summary: circular } }), 'summary: [Unserializable value]');

  const hostileErrors = new Proxy({}, {
    ownKeys() {
      throw new Error('broken ownKeys');
    },
  });
  assert.doesNotThrow(() => formatJiraErrorDetail({ errors: hostileErrors }));
  assert.equal(formatJiraErrorDetail({ errors: hostileErrors }), 'Unknown error');
});

test('formats an absent Jira detail with the legacy unknown fallback', () => {
  assert.equal(formatJiraErrorDetail(undefined), 'Unknown error');
});
