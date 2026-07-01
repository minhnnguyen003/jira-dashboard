import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PROFILE_COOKIE_MAX_AGE_SECONDS,
  PROFILE_COOKIE_NAMES,
  buildProfileCookieAssignments,
  parseProfileCookieString,
} from './profile-cookie.js';

test('parseProfileCookieString returns null when display name is missing', () => {
  assert.equal(parseProfileCookieString('jira_email=minh%40etc.vn'), null);
});

test('parseProfileCookieString returns profile with empty avatar when only name+email exist', () => {
  assert.deepEqual(
    parseProfileCookieString('jira_display_name=Minh%20Nguyen; jira_email=minh%40etc.vn'),
    {
      displayName: 'Minh Nguyen',
      email: 'minh@etc.vn',
      avatarUrl: '',
    },
  );
});

test('parseProfileCookieString decodes avatar url when present', () => {
  const cookie =
    'jira_display_name=Minh%20Nguyen; jira_email=minh%40etc.vn; ' +
    'jira_avatar_url=https%3A%2F%2Fjira%2Favatar%3Fsize%3D48';
  assert.deepEqual(parseProfileCookieString(cookie), {
    displayName: 'Minh Nguyen',
    email: 'minh@etc.vn',
    avatarUrl: 'https://jira/avatar?size=48',
  });
});

test('buildProfileCookieAssignments creates 2-year cookies for name, email, avatar', () => {
  const assignments = buildProfileCookieAssignments({
    displayName: 'Minh Nguyen',
    email: 'minh@etc.vn',
    avatarUrl: 'https://jira/avatar?size=48',
  });

  assert.equal(assignments.length, 3);
  assert.ok(assignments[0].includes(`${PROFILE_COOKIE_NAMES.displayName}=Minh%20Nguyen`));
  assert.ok(assignments[1].includes(`${PROFILE_COOKIE_NAMES.email}=minh%40etc.vn`));
  assert.ok(assignments[2].includes(`${PROFILE_COOKIE_NAMES.avatarUrl}=https%3A%2F%2Fjira%2Favatar%3Fsize%3D48`));
  assert.ok(assignments.every((cookie) => cookie.includes(`Max-Age=${PROFILE_COOKIE_MAX_AGE_SECONDS}`)));
  assert.ok(assignments.every((cookie) => cookie.includes('Path=/')));
  assert.ok(assignments.every((cookie) => cookie.includes('SameSite=Lax')));
});
