import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAssigneeJql,
  readProfileFromRequestCookieHeader,
} from './profileAssignee.js';

test('readProfileFromRequestCookieHeader parses profile cookies', () => {
  assert.deepEqual(
    readProfileFromRequestCookieHeader('jira_display_name=Minh%20Nguyen; jira_email=minh%40etc.vn'),
    {
      displayName: 'Minh Nguyen',
      email: 'minh@etc.vn',
    },
  );
});

test('buildAssigneeJql uses jira_email from profile cookie', () => {
  assert.equal(
    buildAssigneeJql({ displayName: 'Minh Nguyen', email: 'minh@etc.vn' }),
    'assignee = "minh@etc.vn"',
  );
});

test('buildAssigneeJql rejects missing jira_email', () => {
  assert.throws(
    () => buildAssigneeJql({ displayName: 'Minh Nguyen', email: '' }),
    /jira_email/,
  );
});
