import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatDateTimeInZone,
  formatDateInZone,
  getDayRangeInZone,
  toJiraDateTimeInZone,
  toZonedDateTimeInput,
} from './dateTime.js';

test('định dạng cùng timestamp theo giờ Việt Nam, không phụ thuộc timezone process', () => {
  const timestamp = '2026-09-04T08:58:00.000Z';

  assert.equal(formatDateTimeInZone(timestamp), '04/09/2026 15:58');
  assert.equal(toZonedDateTimeInput(timestamp), '2026-09-04T15:58');
});

test('định dạng ngày dashboard theo giờ Việt Nam', () => {
  assert.equal(formatDateInZone('2026-09-04T17:30:00.000Z'), '05/09/2026');
});

test('giữ nguyên giờ nhập theo Việt Nam khi tạo timestamp Jira có offset rõ ràng', () => {
  assert.equal(
    toJiraDateTimeInZone('2026-09-04T15:58'),
    '2026-09-04T15:58:00.000+0700',
  );
});

test('tạo ranh giới một ngày theo giờ Việt Nam dưới dạng instant UTC', () => {
  assert.deepEqual(getDayRangeInZone('2026-09-04'), {
    start: '2026-09-03T17:00:00.000Z',
    end: '2026-09-04T16:59:59.999Z',
  });
});
