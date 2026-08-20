function getMonthDateRange(year, month) {
  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 0)),
  };
}

function isWeekday(date) {
  const day = date.getUTCDay();
  return day >= 1 && day <= 5;
}

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

export function calculateWorkingDays(year, month, holidayDates, additionalDates) {
  const { start, end } = getMonthDateRange(year, month);
  let workingDays = 0;

  for (let cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const iso = toIsoDate(cursor);
    if ((isWeekday(cursor) && !holidayDates.has(iso)) || additionalDates.has(iso)) {
      workingDays += 1;
    }
  }

  return workingDays;
}
