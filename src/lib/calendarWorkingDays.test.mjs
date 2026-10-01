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

test('ngày vừa là ngày nghỉ vừa là ngày làm bù thì tính là ngày nghỉ', async () => {
  const { isWorkingDate, calculateWorkingDays } = await import('./calendarWorkingDays.js');

  // 2026-08-22 là thứ Bảy, 2026-08-31 là thứ Hai.
  const holidayDates = new Set(['2026-08-22', '2026-08-31']);
  const additionalDates = new Set(['2026-08-22', '2026-08-31']);

  assert.equal(isWorkingDate('2026-08-22', holidayDates, additionalDates), false);
  assert.equal(isWorkingDate('2026-08-31', holidayDates, additionalDates), false);
  assert.equal(calculateWorkingDays(2026, 8, holidayDates, additionalDates), 20);
});
