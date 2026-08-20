import assert from 'node:assert/strict';
import test from 'node:test';

test('ngày làm bù thay thế ngày nghỉ khi tạo danh sách ngày công', async () => {
  const calendarWorkingDays = await import('./calendarWorkingDays.js');

  assert.equal(typeof calendarWorkingDays.isWorkingDate, 'function');

  const holidayDates = new Set(['2026-08-31']);
  const additionalDates = new Set(['2026-08-22']);

  assert.equal(calendarWorkingDays.isWorkingDate('2026-08-22', holidayDates, additionalDates), true);
  assert.equal(calendarWorkingDays.isWorkingDate('2026-08-31', holidayDates, additionalDates), false);
});
