import axios from 'axios';

/**
 * @param {unknown} error
 * @returns {{ status: string | number; detail: unknown }}
 */
export function getJiraErrorDetails(error) {
  if (axios.isAxiosError(error)) {
    return {
      status: error.response?.status ?? error.code ?? 'UNKNOWN',
      detail: error.response?.data ?? error.message,
    };
  }

  return {
    status: 'UNKNOWN',
    detail: error instanceof Error ? error.message : error,
  };
}
