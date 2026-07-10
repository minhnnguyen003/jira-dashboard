import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.join(process.cwd(), 'src/app/browse-tasks/page.tsx'), 'utf8');

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
