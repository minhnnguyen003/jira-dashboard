import test from 'node:test';
import assert from 'node:assert/strict';

let calendarTimeline = null;
try {
  calendarTimeline = await import('./calendarTimeline.js');
} catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
}

test('chia task kéo dài qua Chủ nhật thành các thanh theo từng tuần lịch', () => {
  assert.equal(typeof calendarTimeline?.buildCalendarTaskSegments, 'function');

  const segments = calendarTimeline.buildCalendarTaskSegments([
    {
      key: 'JIRA-42',
      summary: 'Task xuyên tuần',
      startDate: '2026-08-28',
      dueDate: '2026-09-09',
    },
  ], new Date(2026, 7, 30), new Date(2026, 8, 12));

  assert.deepEqual(
    segments.map(({ task, weekIndex, startDayIndex, span }) => ({ key: task.key, weekIndex, startDayIndex, span })),
    [
      { key: 'JIRA-42', weekIndex: 0, startDayIndex: 0, span: 7 },
      { key: 'JIRA-42', weekIndex: 1, startDayIndex: 0, span: 4 },
    ],
  );
});

test('bỏ qua task thiếu ngày bắt đầu hoặc hạn hoàn thành', () => {
  assert.equal(typeof calendarTimeline?.buildCalendarTaskSegments, 'function');

  const segments = calendarTimeline.buildCalendarTaskSegments([
    { key: 'JIRA-1', summary: 'Thiếu hạn', startDate: '2026-09-01', dueDate: '-' },
    { key: 'JIRA-2', summary: 'Thiếu bắt đầu', startDate: '-', dueDate: '2026-09-03' },
  ], new Date(2026, 7, 30), new Date(2026, 8, 12));

  assert.deepEqual(segments, []);
});

test('xếp các task không giao ngày vào cùng một hàng trong tuần', () => {
  assert.equal(typeof calendarTimeline?.assignCalendarSegmentLanes, 'function');

  const segments = calendarTimeline.assignCalendarSegmentLanes([
    { task: { key: 'JIRA-1' }, weekIndex: 0, startDayIndex: 0, span: 2 },
    { task: { key: 'JIRA-2' }, weekIndex: 0, startDayIndex: 3, span: 2 },
    { task: { key: 'JIRA-3' }, weekIndex: 0, startDayIndex: 1, span: 3 },
  ]);

  assert.deepEqual(
    segments.map(({ task, lane }) => ({ key: task.key, lane })),
    [
      { key: 'JIRA-1', lane: 0 },
      { key: 'JIRA-2', lane: 0 },
      { key: 'JIRA-3', lane: 1 },
    ],
  );
});

test('tái sử dụng hàng dù dữ liệu task không theo thứ tự ngày bắt đầu', () => {
  const segments = calendarTimeline.assignCalendarSegmentLanes([
    { task: { key: 'JIRA-THU' }, weekIndex: 0, startDayIndex: 4, span: 1 },
    { task: { key: 'JIRA-MON' }, weekIndex: 0, startDayIndex: 1, span: 2 },
  ]);

  assert.deepEqual(
    segments.map(({ task, lane }) => ({ key: task.key, lane })),
    [
      { key: 'JIRA-THU', lane: 0 },
      { key: 'JIRA-MON', lane: 0 },
    ],
  );
});

test('đặt task kéo dài ở các lane dưới task một ngày', () => {
  const segments = calendarTimeline.buildCalendarTaskSegments([
    { key: 'JIRA-SPAN-1', startDate: '2026-09-01', dueDate: '2026-09-03' },
    { key: 'JIRA-SINGLE', startDate: '2026-09-01', dueDate: '2026-09-01' },
    { key: 'JIRA-SPAN-2', startDate: '2026-09-05', dueDate: '2026-09-06' },
  ], new Date(2026, 7, 30), new Date(2026, 8, 5));

  assert.deepEqual(
    segments.map(({ task, lane }) => ({ key: task.key, lane })),
    [
      { key: 'JIRA-SPAN-1', lane: 1 },
      { key: 'JIRA-SINGLE', lane: 0 },
      { key: 'JIRA-SPAN-2', lane: 1 },
    ],
  );
});

test('mở rộng tháng thành các tuần lịch hoàn chỉnh', () => {
  assert.equal(typeof calendarTimeline?.getMonthCalendarRange, 'function');

  const range = calendarTimeline.getMonthCalendarRange(new Date(2026, 8, 1));

  assert.deepEqual(
    [range.start.getFullYear(), range.start.getMonth() + 1, range.start.getDate()],
    [2026, 8, 30],
  );
  assert.deepEqual(
    [range.end.getFullYear(), range.end.getMonth() + 1, range.end.getDate()],
    [2026, 10, 3],
  );
});
