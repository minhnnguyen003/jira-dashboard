import assert from 'node:assert/strict';
import test from 'node:test';

test('thêm ngày nghỉ chuẩn hóa tên, sắp xếp theo ngày và chặn ngày trùng', async () => {
  const calendarConfig = await import('./calendarConfig.js');

  assert.equal(typeof calendarConfig.addCalendarEntry, 'function');

  const entries = [
    { date: '2026-09-02', name: 'Quốc khánh' },
  ];

  const updated = calendarConfig.addCalendarEntry(entries, {
    date: '2026-01-01',
    name: '  Tết Dương lịch  ',
  });

  assert.deepEqual(updated, [
    { date: '2026-01-01', name: 'Tết Dương lịch' },
    { date: '2026-09-02', name: 'Quốc khánh' },
  ]);

  assert.throws(
    () => calendarConfig.addCalendarEntry(updated, { date: '2026-01-01', name: 'Ngày khác' }),
    /đã tồn tại/i,
  );
});

test('cập nhật mục lịch kiểm tra ngày hợp lệ và không cho trùng với mục khác', async () => {
  const { updateCalendarEntry } = await import('./calendarConfig.js');
  const entries = [
    { date: '2026-01-01', name: 'Tết Dương lịch' },
    { date: '2026-09-02', name: 'Quốc khánh' },
  ];

  assert.throws(
    () => updateCalendarEntry(entries, '2026-01-01', { date: '2026-02-30', name: 'Không hợp lệ' }),
    /không hợp lệ/i,
  );
  assert.throws(
    () => updateCalendarEntry(entries, '2026-01-01', { date: '2026-09-02', name: 'Trùng' }),
    /đã tồn tại/i,
  );
});

test('xóa ngày lịch theo ngày đã chọn và báo lỗi khi ngày không tồn tại', async () => {
  const { deleteCalendarEntry } = await import('./calendarConfig.js');
  const entries = [
    { date: '2026-01-01', name: 'Tết Dương lịch' },
    { date: '2026-09-02', name: 'Quốc khánh' },
  ];

  assert.deepEqual(deleteCalendarEntry(entries, '2026-01-01'), [
    { date: '2026-09-02', name: 'Quốc khánh' },
  ]);
  assert.throws(() => deleteCalendarEntry(entries, '2026-12-31'), /không tìm thấy/i);
});
