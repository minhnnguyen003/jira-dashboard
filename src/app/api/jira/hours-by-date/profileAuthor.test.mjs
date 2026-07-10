import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildWorklogAuthorJql,
  readProfileFromRequestCookieHeader,
} from './profileAuthor.js';

test('readProfileFromRequestCookieHeader returns null when jira_display_name is missing', () => {
  assert.equal(readProfileFromRequestCookieHeader('jira_email=minh%40etc.vn'), null);
});

test('readProfileFromRequestCookieHeader parses display name and email from cookies', () => {
  assert.deepEqual(
    readProfileFromRequestCookieHeader('jira_display_name=Minh%20Nguyen; jira_email=minh%40etc.vn'),
    {
      displayName: 'Minh Nguyen',
      email: 'minh@etc.vn',
      avatarUrl: '',
    },
  );
});

test('buildWorklogAuthorJql uses jira_email from profile cookie instead of currentUser', () => {
  assert.equal(
    buildWorklogAuthorJql({ displayName: 'Minh Nguyen', email: 'minh@etc.vn' }),
    'worklogAuthor = "minh@etc.vn"',
  );
});

test('buildWorklogAuthorJql rejects profile without email', () => {
  assert.throws(
    () => buildWorklogAuthorJql({ displayName: 'Minh Nguyen', email: '' }),
    /jira_email/,
  );
});
