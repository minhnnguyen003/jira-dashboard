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

test('reconciles the full external selection snapshot without remounting', () => {
  assert.doesNotMatch(source, /key=\{syncKey\}/);
  assert.doesNotMatch(source, /\bsyncKey\b/);
  assert.match(source, /createAssigneeInputSnapshot/);
  assert.match(source, /reconcileAssigneeInputState/);
  assert.match(source, /reconciledInputState !== inputState/);
  assert.match(source, /setInputState\(reconciledInputState\)/);
  assert.match(source, /editAssigneeInputState\(externalSnapshot, nextQuery\)/);

  const chooseBody = source.match(/const choose = \(user: AssigneeOption \| null\) => \{([\s\S]*?)\n  \};/)?.[1];
  assert.ok(chooseBody);
  assert.match(chooseBody, /chooseAssigneeInputState\(user\)/);
  assert.ok(chooseBody.indexOf('setInputState(nextInputState)') < chooseBody.indexOf('onChange(nextInputState.snapshot.value)'));
});

test('guards blur callbacks with a generation invalidated by external commits and interactions', () => {
  assert.match(source, /useLayoutEffect/);
  assert.match(source, /selectedIdentity/);
  assert.match(source, /selectedDisplayName/);
  assert.match(source, /blurGeneration\.current \+= 1/);
  assert.match(source, /runAssigneeBlurIfCurrent/);

  const timeoutBody = source.match(/window\.setTimeout\(\(\) => \{([\s\S]*?)\n    \}, 0\)/)?.[1];
  assert.ok(timeoutBody);
  assert.ok(timeoutBody.indexOf('runAssigneeBlurIfCurrent') < timeoutBody.indexOf('resolveAssigneeInput'));
});

test('keeps focus on primary mouse down and selects through click', () => {
  const mouseDownBody = source.match(/onMouseDown=\{\(event\) => \{([\s\S]*?)\}\}/)?.[1];
  assert.ok(mouseDownBody);
  assert.match(mouseDownBody, /event\.button === 0/);
  assert.match(mouseDownBody, /event\.preventDefault\(\)/);
  assert.doesNotMatch(mouseDownBody, /choose\(/);
  assert.match(source, /onClick=\{\(\) => choose\(user\)\}/);
});

test('renders live messages outside a conditional options listbox', () => {
  assert.match(source, /const hasOptions/);
  assert.match(source, /const activeOption = hasOptions \?/);
  assert.match(source, /aria-controls=\{hasOptions \? listboxId : undefined\}/);
  assert.match(source, /\{hasOptions && \(/);
  assert.match(source, /role="status"\s+aria-live="polite"/);
  assert.match(source, /role="alert"\s+aria-live="assertive"/);
  assert.match(source, /\{open && !loading && error && \(/);

  const listboxStart = source.indexOf('role="listbox"');
  const optionMapStart = source.indexOf('filtered.map', listboxStart);
  assert.ok(listboxStart >= 0 && optionMapStart > listboxStart);
  assert.doesNotMatch(source.slice(listboxStart, optionMapStart), /role="status"|role="alert"/);
});
