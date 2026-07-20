import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.join(process.cwd(), 'src/app/browse-tasks/page.tsx'), 'utf8');
const loaderSource = fs.readFileSync(path.join(process.cwd(), 'src/app/browse-tasks/browseUsersLoader.js'), 'utf8');

test('browse task filter is an inline expandable panel', () => {
  assert.match(source, /function FilterPanel\(/);
  assert.match(source, /id="browse-tasks-filter-panel"/);
  assert.match(source, /aria-expanded=\{showFilterPanel\}/);
  assert.match(source, /aria-controls="browse-tasks-filter-panel"/);
  assert.match(source, /inert=\{!expanded \? true : undefined\}/);
  assert.doesNotMatch(source, /fixed inset-0 z-\[300\]/);
  assert.doesNotMatch(source, /autoFocus/);
});

test('filter panel remains mounted and applying filters keeps it expanded', () => {
  assert.match(source, /<FilterPanel[\s\S]*expanded=\{showFilterPanel\}/);
  assert.doesNotMatch(source, /\{showFilterPanel && \(\s*<FilterPanel/);
  assert.doesNotMatch(source, /handleSubmitFilters[\s\S]{0,220}setShowFilterPanel\(false\)/);
});

test('loads all users once and delegates local filtering to the assignee combobox', () => {
  assert.match(source, /import AssigneeCombobox from '@\/components\/form\/AssigneeCombobox'/);
  assert.match(source, /import \{ consumeBrowseUsers, loadBrowseUsers \} from '\.\/browseUsersLoader\.js'/);
  assert.match(loaderSource, /fetch\('\/api\/jira\/users\?all=true'\)/);
  assert.match(source, /<AssigneeCombobox[\s\S]*users=\{users\}[\s\S]*onChange=/);
  assert.doesNotMatch(source + loaderSource, /users\?query=/);
  assert.doesNotMatch(source, /<select[\s\S]{0,300}filters\.assignee/);
});

test('keeps users loading and errors independent from task loading and errors', () => {
  assert.match(source, /const \[usersLoading, setUsersLoading\]/);
  assert.match(source, /const \[usersError, setUsersError\]/);
});

test('keeps StrictMode consumers local without aborting the shared users request', () => {
  assert.match(source, /let usersActive = true/);
  assert.match(source, /consumeBrowseUsers\([\s\S]*\(\) => usersActive/);
  assert.match(source, /return \(\) => \{\s*usersActive = false;\s*\}/);
  assert.doesNotMatch(source, /AbortController|usersController/);
});
