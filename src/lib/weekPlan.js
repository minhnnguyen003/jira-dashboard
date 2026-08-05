export const WEEK_PLAN_COLUMNS = [
  'Open',
  'In Progress',
  'Closed / Resolved',
  'Pending',
  'Cancelled',
  'Overdue',
];

function normalizeStatus(status = '') {
  return String(status).trim().toLowerCase();
}

function parseDisplayDateTime(value) {
  if (!value || value === '-') return null;

  const trimmed = String(value).trim();
  if (!trimmed) return null;

  const date = new Date(trimmed);
  if (!Number.isNaN(date.getTime())) {
    return date;
  }

  const normalized = trimmed.replace(/\s+/g, ' ');
  const [datePart, timePart = '00:00'] = normalized.split(' ');
  const dateSegments = datePart.split(/[\/\-]/).map((segment) => Number(segment));

  if (dateSegments.length !== 3 || dateSegments.some((segment) => !Number.isFinite(segment))) {
    return null;
  }

  const [first, second, third] = dateSegments;
  const year = third > 31 ? third : first > 31 ? first : third;
  const month = third > 31 ? second : second > 31 ? third : second;
  const day = third > 31 ? first : first > 31 ? second : first;

  const [hours = 0, minutes = 0] = String(timePart).split(':').map((segment) => Number(segment) || 0);
  return new Date(year, month - 1, day, hours, minutes, 0);
}

export function getCurrentWeekRange(referenceDate = new Date()) {
  const reference = new Date(referenceDate);
  const weekday = reference.getDay();
  const diffToMonday = (weekday + 6) % 7;

  const start = new Date(reference);
  start.setDate(reference.getDate() - diffToMonday);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

export function formatDateForInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function groupWeekPlanTasks(tasks, referenceDate = new Date()) {
  const grouped = Object.fromEntries(WEEK_PLAN_COLUMNS.map((column) => [column, []]));
  const now = new Date(referenceDate);

  const sortedTasks = [...tasks].sort((a, b) => {
    const dueA = parseDisplayDateTime(a.dueDate);
    const dueB = parseDisplayDateTime(b.dueDate);
    if (!dueA && !dueB) return a.summary.localeCompare(b.summary);
    if (!dueA) return 1;
    if (!dueB) return -1;
    return dueA.getTime() - dueB.getTime();
  });

  sortedTasks.forEach((task) => {
    const status = normalizeStatus(task.status);
    const dueDate = parseDisplayDateTime(task.dueDate);
    const isOverdue = dueDate && dueDate < now && !['cancelled', 'canceled', 'resolved', 'closed', 'done', 'pending'].includes(status);

    let bucket = 'Open';

    if (status.includes('in progress') || status.includes('in_progress')) {
      bucket = 'In Progress';
    } else if (status.includes('pending')) {
      bucket = 'Pending';
    } else if (status.includes('cancelled') || status.includes('canceled')) {
      bucket = 'Cancelled';
    } else if (status.includes('resolved') || status.includes('closed') || status.includes('done')) {
      bucket = 'Closed / Resolved';
    } else if (status.includes('open') || status.includes('todo') || status.includes('to do')) {
      bucket = 'Open';
    }

    if (isOverdue) {
      bucket = 'Overdue';
    }

    grouped[bucket]?.push(task);
  });

  return grouped;
}
