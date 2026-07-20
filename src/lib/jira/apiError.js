import axios from 'axios';

function safeStringify(value) {
  try {
    const serialized = JSON.stringify(value, (_key, candidate) => (
      typeof candidate === 'bigint' ? candidate.toString() : candidate
    ));
    if (serialized !== undefined) return serialized;
    return 'Unknown error';
  } catch {
    return '[Unserializable value]';
  }
}

function formatErrorValue(value) {
  return typeof value === 'string' ? value : safeStringify(value);
}

/**
 * @param {unknown} detail
 * @returns {string}
 */
export function formatJiraErrorDetail(detail) {
  try {
    if (detail !== null && typeof detail === 'object') {
      const errors = detail.errors;
      if (errors !== null && typeof errors === 'object' && !Array.isArray(errors)) {
        const formattedErrors = Object.entries(errors)
          .map(([field, value]) => `${field}: ${formatErrorValue(value)}`)
          .join(' | ');
        if (formattedErrors) return formattedErrors;
      }

      const errorMessages = detail.errorMessages;
      if (Array.isArray(errorMessages)) {
        const joinedMessages = errorMessages.join(', ');
        if (joinedMessages) return joinedMessages;
      }

      if (typeof detail.message === 'string' && detail.message) {
        return detail.message;
      }
    }

    return safeStringify(detail);
  } catch {
    const fallback = safeStringify(detail);
    return fallback === '[Unserializable value]' ? 'Unknown error' : fallback;
  }
}

/**
 * @param {unknown} error
 * @returns {{ status: string | number; detail: unknown }}
 */
export function getJiraErrorDetails(error) {
  if (axios.isAxiosError(error)) {
    return {
      status: error.response?.status ?? error.code ?? 'UNKNOWN',
      detail: error.response?.data || error.message || 'Unknown error',
    };
  }

  return {
    status: 'UNKNOWN',
    detail: error instanceof Error ? error.message : error,
  };
}
