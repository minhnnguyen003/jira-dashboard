function parseVnDate(dateStr) {
  if (!dateStr || dateStr === '-') return null;
  const match = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/);
  if (!match) return dateStr;
  const [, day, month, year, hours, minutes] = match;
  return `${year}-${month}-${day}T${hours}:${minutes}:00.000+0700`;
}

export function normalizeRemainingEstimateValue(value) {
  if (typeof value !== 'string') {
    return '';
  }

  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return '';
  }

  if (!/^\d+$/.test(trimmedValue)) {
    return trimmedValue;
  }

  const totalSeconds = Number(trimmedValue);
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return '';
  }

  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const parts = [];

  if (days > 0) {
    parts.push(`${days}d`);
  }
  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  if (minutes > 0) {
    parts.push(`${minutes}m`);
  }

  return parts.length > 0 ? parts.join(' ') : '0m';
}

export function sanitizeTransitionFields(fields) {
  if (!fields || typeof fields !== 'object') {
    return undefined;
  }

  const cleanedFields = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value === null || value === '') {
      continue;
    }

    if (typeof value === 'object' && !Array.isArray(value)) {
      const entries = Object.entries(value).filter(([, nestedValue]) => nestedValue !== null && nestedValue !== '');
      if (entries.length > 0) {
        cleanedFields[key] = Object.fromEntries(entries);
      }
      continue;
    }

    cleanedFields[key] = value;
  }

  return Object.keys(cleanedFields).length > 0 ? cleanedFields : undefined;
}

export function buildTransitionFields(requiredFields, fieldValues, issueFields) {
  const transitionPayload = {};

  for (const [fieldId, fieldDef] of Object.entries(requiredFields || {})) {
    const val = fieldValues?.[fieldId];

    if (fieldDef.schema?.type === 'resolution') {
      const selectedResolution = fieldDef.allowedValues?.find((resolution) => resolution.name === val);
      if (selectedResolution) {
        transitionPayload[fieldId] = { id: selectedResolution.id };
      }
      continue;
    }

    if (fieldId === 'customfield_10300' || fieldId === 'customfield_10302') {
      transitionPayload[fieldId] = val ? parseVnDate(val) : null;
      continue;
    }

    if (fieldId === 'customfield_10304') {
      if (val) {
        transitionPayload[fieldId] = val;
      }
      continue;
    }

    if (fieldId === 'timetracking') {
      const remainingEstimate = normalizeRemainingEstimateValue(val);
      const fallbackEstimate = normalizeRemainingEstimateValue(issueFields?.timeestimate);
      const estimateToUse = remainingEstimate || fallbackEstimate;

      if (estimateToUse) {
        transitionPayload[fieldId] = {
          remainingEstimate: estimateToUse,
        };
      }
      continue;
    }

    if (val) {
      transitionPayload[fieldId] = val;
    }
  }

  return sanitizeTransitionFields(transitionPayload);
}
