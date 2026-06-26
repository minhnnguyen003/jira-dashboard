import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createHoursByDateInitialState,
  updateHoursByDateDraftRange,
  applyHoursByDateDraftRange,
} from './filterState.js';

test('changing draft range does not change applied range until explicitly applied', () => {
  const initial = createHoursByDateInitialState('2026-06-01', '2026-06-30');
  const draftChanged = updateHoursByDateDraftRange(initial, {
    from: '2026-07-01',
    to: '2026-07-31',
  });

  assert.deepEqual(draftChanged.appliedRange, {
    from: '2026-06-01',
    to: '2026-06-30',
  });
  assert.deepEqual(draftChanged.draftRange, {
    from: '2026-07-01',
    to: '2026-07-31',
  });

  const applied = applyHoursByDateDraftRange(draftChanged);

  assert.deepEqual(applied.appliedRange, {
    from: '2026-07-01',
    to: '2026-07-31',
  });
});
