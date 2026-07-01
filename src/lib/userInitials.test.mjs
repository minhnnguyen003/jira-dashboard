import test from 'node:test';
import assert from 'node:assert/strict';

import { getUserInitials } from './userInitials.js';

test('returns first letters of first two words, uppercased', () => {
  assert.equal(getUserInitials('Minh Nguyen'), 'MN');
});

test('returns single letter for a one-word name', () => {
  assert.equal(getUserInitials('Minh'), 'M');
});

test('ignores extra whitespace between words', () => {
  assert.equal(getUserInitials('  Minh   Van  Nguyen '), 'MV');
});

test('returns "?" for empty or missing name', () => {
  assert.equal(getUserInitials(''), '?');
  assert.equal(getUserInitials(undefined), '?');
  assert.equal(getUserInitials(null), '?');
});
