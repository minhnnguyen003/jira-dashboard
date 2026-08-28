function isIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function normalizeEntry(entry) {
  const date = entry?.date;
  const name = typeof entry?.name === 'string' ? entry.name.trim() : '';

  if (!isIsoDate(date)) throw new Error('Ngày không hợp lệ.');
  if (!name) throw new Error('Tên ngày là bắt buộc.');

  return { date, name };
}

function sortEntries(entries) {
  return [...entries].sort((left, right) => left.date.localeCompare(right.date));
}

export function addCalendarEntry(entries, entry) {
  const normalized = normalizeEntry(entry);
  if (entries.some((item) => item.date === normalized.date)) {
    throw new Error('Ngày này đã tồn tại.');
  }
  return sortEntries([...entries, normalized]);
}

export function updateCalendarEntry(entries, originalDate, entry) {
  const normalized = normalizeEntry(entry);
  const index = entries.findIndex((item) => item.date === originalDate);
  if (index < 0) throw new Error('Không tìm thấy ngày cần cập nhật.');
  if (normalized.date !== originalDate && entries.some((item) => item.date === normalized.date)) {
    throw new Error('Ngày này đã tồn tại.');
  }

  const updated = [...entries];
  updated[index] = normalized;
  return sortEntries(updated);
}

export function deleteCalendarEntry(entries, date) {
  const updated = entries.filter((item) => item.date !== date);
  if (updated.length === entries.length) throw new Error('Không tìm thấy ngày cần xóa.');
  return updated;
}
