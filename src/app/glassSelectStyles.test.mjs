import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const globalsCss = fs.readFileSync(path.join(process.cwd(), 'src/app/globals.css'), 'utf8');

test('glass-select defines native option styling for dark mode', () => {
  assert.match(globalsCss, /select\.glass-select option\s*\{/);
  assert.match(globalsCss, /background:\s*var\(--dropdown-bg\)/);
  assert.match(globalsCss, /color:\s*var\(--text\)/);
});

test('glass-select keeps explicit light-mode option override', () => {
  assert.match(globalsCss, /\[data-theme="light"\]\s+select\.glass-select option\s*\{/);
});
