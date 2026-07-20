function formatTime(seconds) {
  if (seconds === null || seconds === undefined || Number(seconds) === 0) return '0h';
  const hours = Number(seconds) / 3600;
  const days = Math.floor(hours / 24);
  const dayHours = Math.floor(hours % 24);
  const minutes = Math.round((hours % 1) * 60);
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (dayHours > 0) parts.push(`${dayHours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  return parts.length > 0 ? parts.join(' ') : '0h';
}

function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '-';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

function formatDateTimeForInput(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function createTaskDetailState(issue) {
  const fields = issue?.fields ?? {};
  const startDate = fields.customfield_10300 || fields.startdate;
  const dueDate = fields.customfield_10302 || fields.duedate;
  const initialDatetimeValues = {
    startDate: formatDateTimeForInput(startDate),
    dueDate: formatDateTimeForInput(dueDate),
    resolutionDate: formatDateTimeForInput(fields.resolutiondate),
  };

  return {
    initialValues: {
      summary: fields.summary || '',
      priority: fields.priority?.name || '',
      assignee: fields.assignee?.displayName || '',
      reporter: fields.reporter?.displayName || '',
      sprint: fields.sprint?.name || '',
      timeoriginalestimate: formatTime(fields.timeoriginalestimate),
      timeestimate: formatTime(fields.timeestimate),
      timespent: formatTime(fields.timespent),
      startDate: formatDateTime(startDate),
      dueDate: formatDateTime(dueDate),
      resolutionDate: formatDateTime(fields.resolutiondate),
      description: fields.description || '',
      epic: fields.epic?.key || '',
      parent: fields.parent?.key || '',
      labels: fields.labels?.join(', ') || '',
      resolution: fields.resolution?.name || '',
      issuetype: fields.issuetype?.name || '',
    },
    initialDatetimeValues,
    editedValues: {},
    datetimeValues: { ...initialDatetimeValues },
  };
}

export function getDescriptionPlaceholder(description, language) {
  if (typeof description === 'string' && description.trim()) {
    return '';
  }

  return language === 'en' ? 'No description' : 'Không có mô tả';
}

export async function runIssueRefresh(issue, onRefresh) {
  if (!issue || typeof onRefresh !== 'function') {
    return issue ?? null;
  }

  const refreshedIssue = await onRefresh(issue);
  return refreshedIssue ?? issue;
}
