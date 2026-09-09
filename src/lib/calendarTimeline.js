function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, count) {
  const result = new Date(date);
  result.setDate(result.getDate() + count);
  return result;
}

export function parseCalendarDate(value) {
  if (!value || value === '-') return null;

  const match = String(value).trim().match(/^(?:(\d{4})-(\d{2})-(\d{2})|(\d{2})\/(\d{2})\/(\d{4}))/);
  if (!match) return null;

  const year = Number(match[1] || match[6]);
  const month = Number(match[2] || match[5]);
  const day = Number(match[3] || match[4]);
  const date = new Date(year, month - 1, day);

  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

export function buildCalendarTaskSegments(tasks, visibleStart, visibleEnd) {
  const firstDay = startOfDay(visibleStart);
  const lastDay = startOfDay(visibleEnd);

  const segments = tasks.flatMap((task) => {
    const taskStart = parseCalendarDate(task.startDate);
    const taskEnd = parseCalendarDate(task.dueDate);
    if (!taskStart || !taskEnd || taskEnd < taskStart || taskEnd < firstDay || taskStart > lastDay) return [];

    const start = taskStart < firstDay ? firstDay : taskStart;
    const end = taskEnd > lastDay ? lastDay : taskEnd;
    const segments = [];
    let cursor = start;

    while (cursor <= end) {
      const weekIndex = Math.floor((cursor.getTime() - firstDay.getTime()) / 604800000);
      const startDayIndex = cursor.getDay();
      const daysUntilSaturday = 6 - startDayIndex;
      const remainingDays = Math.floor((end.getTime() - cursor.getTime()) / 86400000) + 1;
      const span = Math.min(daysUntilSaturday + 1, remainingDays);

      segments.push({ task, weekIndex, startDayIndex, span });
      cursor = addDays(cursor, span);
    }

    return segments;
  });

  return assignCalendarSegmentLanes(segments);
}

export function assignCalendarSegmentLanes(segments) {
  const lanesByWeek = new Map();
  const laneBySegment = new Map();

  const sortedSegments = segments
    .map((segment, index) => ({ segment, index }))
    .sort((left, right) => left.segment.weekIndex - right.segment.weekIndex
      || left.segment.startDayIndex - right.segment.startDayIndex
      || right.segment.span - left.segment.span
      || left.index - right.index);

  sortedSegments.forEach(({ segment, index }) => {
    const weekLanes = lanesByWeek.get(segment.weekIndex) || [];
    const segmentStart = segment.startDayIndex;
    const segmentEnd = segment.startDayIndex + segment.span - 1;
    let lane = weekLanes.findIndex((lastOccupiedDay) => lastOccupiedDay < segmentStart);

    if (lane === -1) {
      lane = weekLanes.length;
      weekLanes.push(segmentEnd);
    } else {
      weekLanes[lane] = segmentEnd;
    }

    lanesByWeek.set(segment.weekIndex, weekLanes);
    laneBySegment.set(index, lane);
  });

  return segments.map((segment, index) => ({ ...segment, lane: laneBySegment.get(index) }));
}

export function getMonthCalendarRange(month) {
  const firstDayOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = addDays(firstDayOfMonth, -firstDayOfMonth.getDay());
  const lastDayOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const end = addDays(lastDayOfMonth, 6 - lastDayOfMonth.getDay());

  return { start, end };
}
