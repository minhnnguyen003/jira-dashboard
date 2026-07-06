import test from 'node:test';
import assert from 'node:assert/strict';

import { buildJiraAvatarProxyUrl } from './jiraAvatar.js';

test('buildJiraAvatarProxyUrl returns empty string for empty input', () => {
  assert.equal(buildJiraAvatarProxyUrl(''), '');
});

test('buildJiraAvatarProxyUrl encodes remote avatar url into local api route', () => {
  assert.equal(
    buildJiraAvatarProxyUrl('https://jira.example/avatar?size=48&owner=minh'),
    '/api/jira/avatar?src=https%3A%2F%2Fjira.example%2Favatar%3Fsize%3D48%26owner%3Dminh',
  );
});
