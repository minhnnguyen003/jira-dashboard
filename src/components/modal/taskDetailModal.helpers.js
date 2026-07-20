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

function getPayloadName(value) {
  return value && typeof value === 'object' && typeof value.name === 'string' ? value.name : '';
}

function getPayloadDateTimeInput(value) {
  if (typeof value !== 'string') return '';
  const match = value.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/);
  return match?.[1] || '';
}

export function getTaskDetailMutationOwner(issue) {
  return issue?.key ?? null;
}

export function canCloseTaskDetail({ saving, transitioning }) {
  return !saving && !transitioning;
}

export function createLatestRequestScope(owner) {
  let currentController = null;
  let disposed = false;

  return {
    owner,
    begin() {
      currentController?.abort();
      const controller = new AbortController();
      currentController = controller;
      if (disposed) controller.abort();

      return {
        signal: controller.signal,
        isCurrent: () => !disposed && currentController === controller && !controller.signal.aborted,
      };
    },
    dispose() {
      disposed = true;
      currentController?.abort();
    },
  };
}

export function getTaskDetailTransitionView(transitionState, issue) {
  if (transitionState.loadedFor !== issue) {
    return {
      loading: true,
      transitions: [],
      loadError: null,
      selectedTransition: null,
      transitionFieldsData: {},
      fieldValues: {},
      actionError: null,
    };
  }

  return {
    loading: false,
    transitions: transitionState.transitions,
    loadError: transitionState.loadError,
    selectedTransition: transitionState.selectedTransition,
    transitionFieldsData: transitionState.transitionFieldsData,
    fieldValues: transitionState.fieldValues,
    actionError: transitionState.actionError,
  };
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
    sourceIssue: issue,
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

export function resolveTaskDetailStateAfterSave(editState, refreshedIssue, sentFields = {}) {
  if (refreshedIssue && typeof refreshedIssue.key === 'string' && refreshedIssue.fields && typeof refreshedIssue.fields === 'object') {
    return createTaskDetailState(refreshedIssue);
  }

  const initialValues = { ...editState.initialValues };
  const initialDatetimeValues = { ...editState.initialDatetimeValues };
  const hasField = (field) => Object.prototype.hasOwnProperty.call(sentFields, field);

  if (hasField('summary')) initialValues.summary = String(sentFields.summary ?? '');
  if (hasField('priority')) initialValues.priority = getPayloadName(sentFields.priority);
  if (hasField('assignee')) initialValues.assignee = getPayloadName(sentFields.assignee);
  if (hasField('description')) initialValues.description = String(sentFields.description ?? '');
  if (hasField('timeoriginalestimate')) initialValues.timeoriginalestimate = formatTime(sentFields.timeoriginalestimate);
  if (hasField('timeestimate')) initialValues.timeestimate = formatTime(sentFields.timeestimate);

  const dateFields = [
    ['customfield_10300', 'startDate'],
    ['customfield_10302', 'dueDate'],
    ['resolutiondate', 'resolutionDate'],
  ];
  for (const [apiField, stateField] of dateFields) {
    if (!hasField(apiField)) continue;
    const inputValue = getPayloadDateTimeInput(sentFields[apiField]);
    initialDatetimeValues[stateField] = inputValue;
    initialValues[stateField] = formatDateTime(inputValue);
  }

  return {
    sourceIssue: editState.sourceIssue,
    initialValues,
    initialDatetimeValues,
    editedValues: {},
    datetimeValues: { ...initialDatetimeValues },
  };
}

export function resetTaskDetailStateForIssue(editState, issue) {
  if (editState.sourceIssue !== issue) {
    return createTaskDetailState(issue);
  }

  return {
    sourceIssue: editState.sourceIssue,
    initialValues: { ...editState.initialValues },
    initialDatetimeValues: { ...editState.initialDatetimeValues },
    editedValues: {},
    datetimeValues: { ...editState.initialDatetimeValues },
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
    return null;
  }

  const refreshedIssue = await onRefresh(issue);
  return refreshedIssue ?? null;
}
