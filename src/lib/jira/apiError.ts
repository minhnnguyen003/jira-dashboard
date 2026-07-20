export declare function formatJiraErrorDetail(detail: unknown): string;

export declare function getJiraErrorDetails(error: unknown): {
  status: string | number;
  detail: unknown;
};
