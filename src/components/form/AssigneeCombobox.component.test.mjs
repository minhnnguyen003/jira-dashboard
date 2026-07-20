import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.join(process.cwd(), 'src/components/form/AssigneeCombobox.tsx'), 'utf8');

test('exposes accessible combobox and listbox semantics', () => {
  assert.match(source, /role="combobox"/);
  assert.match(source, /aria-autocomplete="list"/);
  assert.match(source, /role="listbox"/);
  assert.match(source, /role="option"/);
  assert.match(source, /onKeyDown=/);
  assert.match(source, /resolveAssigneeInput/);
});

test('coordinates option clicks and external resets with pending blur resolution', () => {
  assert.match(source, /onMouseDown=/);
  assert.match(source, /event\.preventDefault\(\)/);
  assert.match(source, /clearTimeout/);
  assert.match(source, /key=\{syncKey\}/);
});
