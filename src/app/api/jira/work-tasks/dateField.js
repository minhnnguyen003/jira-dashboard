export const DATE_FIELD_OPTIONS = [
  { value: 'startDate', label: 'Start Date', jqlField: 'cf[10300]', orderBy: 'cf[10300]' },
  { value: 'created', label: 'Creation Date', jqlField: 'created', orderBy: 'created' },
  { value: 'updated', label: 'Lasted Update', jqlField: 'updated', orderBy: 'updated' },
  { value: 'endDate', label: 'End Date', jqlField: 'cf[10302]', orderBy: 'cf[10302]' },
];

const DATE_FIELD_VALUES = new Set(DATE_FIELD_OPTIONS.map((option) => option.value));

export function normalizeDateField(dateField) {
  if (!dateField || !DATE_FIELD_VALUES.has(dateField)) {
    return 'startDate';
  }

  return dateField;
}

export function getDateFieldConfig(dateField) {
  const normalizedDateField = normalizeDateField(dateField);
  return DATE_FIELD_OPTIONS.find((option) => option.value === normalizedDateField);
}

export function buildDateClauses({ from, to, dateField }) {
  const config = getDateFieldConfig(dateField);
  const clauses = [];

  if (from) {
    clauses.push(`${config.jqlField} >= "${from} 00:00"`);
  }

  if (to) {
    clauses.push(`${config.jqlField} <= "${to} 23:59"`);
  }

  return {
    clauses,
    orderBy: `${config.orderBy} DESC`,
    config,
  };
}
