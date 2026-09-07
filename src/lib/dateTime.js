export const APP_TIME_ZONE = 'Asia/Ho_Chi_Minh';
const JIRA_VN_OFFSET = '+0700';

function toValidDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatParts(date) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });

  return Object.fromEntries(
    formatter.formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
}

export function formatDateTimeInZone(value) {
  const date = toValidDate(value);
  if (!date) return '-';

  const { day, month, year, hour, minute } = formatParts(date);
  return `${day}/${month}/${year} ${hour}:${minute}`;
}

export function formatDateInZone(value) {
  const date = toValidDate(value);
  if (!date) return '-';

  const { day, month, year } = formatParts(date);
  return `${day}/${month}/${year}`;
}

export function toZonedDateTimeInput(value) {
  const date = toValidDate(value);
  if (!date) return '';

  const { day, month, year, hour, minute } = formatParts(date);
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

export function toDateInZone(value) {
  const date = toValidDate(value);
  if (!date) return '';

  const { day, month, year } = formatParts(date);
  return `${year}-${month}-${day}`;
}

export function toJiraDateTimeInZone(value) {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;

  const [, date, hour, minute, second = '00'] = match;
  return `${date}T${hour}:${minute}:${second}.000${JIRA_VN_OFFSET}`;
}

export function getDayRangeInZone(isoDate) {
  if (typeof isoDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;

  const start = toValidDate(`${isoDate}T00:00:00.000${JIRA_VN_OFFSET}`);
  const end = toValidDate(`${isoDate}T23:59:59.999${JIRA_VN_OFFSET}`);
  if (!start || !end) return null;

  return { start: start.toISOString(), end: end.toISOString() };
}
