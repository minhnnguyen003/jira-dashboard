// OpenAPI 3.0 description of the dashboard's own HTTP API (the Next.js route handlers under src/app/api).
// Served at /api/openapi.json and rendered by Swagger UI at /api-docs.

type Json = Record<string, unknown>;

const ref = (name: string): Json => ({ $ref: `#/components/schemas/${name}` });
const str = (description?: string, extra: Json = {}): Json => ({ type: 'string', ...(description ? { description } : {}), ...extra });
const arrayOf = (items: Json): Json => ({ type: 'array', items });
const jsonBody = (schema: Json, required = true): Json => ({ required, content: { 'application/json': { schema } } });
const jsonOk = (description: string, schema: Json): Json => ({ description, content: { 'application/json': { schema } } });
const errorResponse = (description: string): Json => jsonOk(description, ref('Error'));
const query = (name: string, schema: Json, description: string, required = false): Json => ({ name, in: 'query', required, description, schema });

const jiraErrors: Json = {
  '500': errorResponse('Jira request failed or the server is misconfigured (missing JIRA_BASE_URL / credentials).'),
};

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Jira Dashboard API',
    version: '1.1.1',
    description:
      'Internal REST API of the Jira Dashboard. Most endpoints are a thin, authenticated proxy to a Jira Server/Cloud instance ' +
      '(credentials come from server-side env vars `JIRA_BASE_URL`, `JIRA_BEARER_TOKEN` or `JIRA_EMAIL` + `JIRA_API_TOKEN`, so no auth header is required from the caller). ' +
      'The `calendar` endpoints manage the local holiday / make-up working-day files.',
  },
  servers: [{ url: '/', description: 'Current origin' }],
  tags: [
    { name: 'Issues', description: 'Search, read, create and update Jira issues' },
    { name: 'Worklog', description: 'Time tracking' },
    { name: 'Lookups', description: 'Reference data used by forms and filters' },
    { name: 'Calendar', description: 'Working-day calendar (holidays and make-up days)' },
  ],
  paths: {
    '/api/jira/search': {
      post: {
        tags: ['Issues'],
        summary: 'Run a JQL search and aggregate the results',
        description: 'Resolves the JQL from `personalMode`, a saved filter (`queryId`) or the raw `jql`, then groups the issues for dashboard charts.',
        requestBody: jsonBody({
          type: 'object',
          properties: {
            jql: str('Raw JQL. Defaults to `project = YOUR_PROJECT ORDER BY updated DESC`.'),
            queryId: str('Numeric id of a saved Jira filter; takes precedence over `jql`.', { pattern: '^\\d+$' }),
            personalMode: { type: 'boolean', description: 'Build a per-user monthly JQL from `assigneeEmail`, `year` and `month`.' },
            assigneeEmail: str(),
            assigneeEmails: arrayOf(str()),
            year: { type: 'integer' },
            month: { type: 'integer', minimum: 1, maximum: 12 },
            groupBy: { type: 'string', enum: ['assignee', 'sprint', 'status', 'epic'], default: 'assignee' },
            statusGrouping: { type: 'string', enum: ['personal'], description: 'Merge Done/Resolved when grouping by status.' },
            startAt: { type: 'integer', default: 0 },
            maxResults: { type: 'integer', default: 50 },
          },
        }, false),
        responses: {
          '200': jsonOk('Search result', {
            type: 'object',
            properties: {
              issues: arrayOf({ type: 'object', additionalProperties: true }),
              fullIssues: { type: 'object', additionalProperties: true, description: 'Raw Jira issues keyed by issue key.' },
              aggregated: arrayOf({ type: 'object', additionalProperties: true }),
              total: { type: 'integer' },
            },
          }),
          ...jiraErrors,
        },
      },
    },
    '/api/jira/browse-tasks': {
      get: {
        tags: ['Issues'],
        summary: 'Browse issues with filters',
        parameters: [
          query('search', { type: 'string' }, 'Text matched against the summary.'),
          query('project', { type: 'string' }, 'Project key.'),
          query('issueType', { type: 'string' }, 'Issue type name.'),
          query('status', arrayOf({ type: 'string' }), 'Status name; repeat for several values.'),
          query('assignee', { type: 'string' }, 'Assignee username.'),
          query('startFrom', { type: 'string', format: 'date' }, 'Lower bound of the date field.'),
          query('startTo', { type: 'string', format: 'date' }, 'Upper bound of the date field.'),
          query('dateField', { type: 'string' }, 'Date field the range applies to.'),
          query('startAt', { type: 'integer', default: 0 }, 'Pagination offset.'),
          query('maxResults', { type: 'integer', default: 1000 }, 'Page size.'),
          query('full', { type: 'boolean', default: false }, 'Also return `fullIssues` keyed by issue key.'),
        ],
        responses: { '200': jsonOk('A page of issues', ref('TaskPage')), ...jiraErrors },
      },
    },
    '/api/jira/work-tasks': {
      get: {
        tags: ['Issues'],
        summary: 'List the tasks the user works on within a date range',
        parameters: [
          query('search', { type: 'string' }, 'Text matched against the summary.'),
          query('from', { type: 'string', format: 'date' }, 'Range start.'),
          query('to', { type: 'string', format: 'date' }, 'Range end.'),
          query('dateField', { type: 'string' }, 'Date field the range applies to.'),
          query('project', { type: 'string' }, 'Project key.'),
          query('issueType', { type: 'string' }, 'Issue type name.'),
          query('startAt', { type: 'integer', default: 0 }, 'Pagination offset.'),
          query('maxResults', { type: 'integer', default: 15 }, 'Page size.'),
          query('full', { type: 'boolean', default: false }, 'Also return `fullIssues`.'),
        ],
        responses: { '200': jsonOk('A page of issues', ref('TaskPage')), ...jiraErrors },
      },
    },
    '/api/jira/issue': {
      get: {
        tags: ['Issues'],
        summary: 'Get one issue by key',
        parameters: [query('key', { type: 'string', example: 'ABC-123' }, 'Issue key.', true)],
        responses: {
          '200': jsonOk('The issue', { type: 'object', additionalProperties: true }),
          '400': errorResponse('`key` is missing.'),
          '500': errorResponse('Jira request failed.'),
        },
      },
    },
    '/api/jira/create': {
      post: {
        tags: ['Issues'],
        summary: 'Create an issue',
        description: 'If Jira rejects fields with "cannot be set", they are dropped and the request is retried once.',
        requestBody: jsonBody({
          type: 'object',
          required: ['project', 'summary'],
          properties: {
            project: str('Project key.', { example: 'ABC' }),
            summary: str(),
            issuetype: str('Issue type name.', { default: 'Task' }),
            description: str(),
            priority: str('Priority name.'),
            assignee: str('Assignee username.'),
            parent: str('Parent issue key (for sub-tasks).'),
            labels: arrayOf(str()),
            components: arrayOf(str('Component name.')),
            customFieldSprint: str('Sprint id.'),
            customFieldEpic: str('Epic key.'),
            customFieldStoryPoints: str('Story points.'),
            startDate: str('`YYYY-MM-DD` or `YYYY-MM-DDTHH:mm`, sent as UTC+7.'),
            dueDate: str('`YYYY-MM-DD` or `YYYY-MM-DDTHH:mm`, sent as UTC+7.'),
            originalEstimate: str('Jira duration, e.g. `2d 4h`.'),
            remainingEstimate: str('Jira duration, e.g. `1d`.'),
          },
        }),
        responses: {
          '200': jsonOk('Created issue', {
            type: 'object',
            properties: { key: str(), id: str(), self: str(undefined, { format: 'uri' }) },
          }),
          default: jsonOk('Jira rejected the request; the HTTP status is forwarded from Jira.', {
            type: 'object',
            properties: { error: { type: 'string' }, detail: { description: 'Raw Jira error body.' } },
          }),
        },
      },
    },
    '/api/jira/update-issue': {
      post: {
        tags: ['Issues'],
        summary: 'Update issue fields',
        requestBody: jsonBody({
          type: 'object',
          required: ['key', 'fields'],
          properties: {
            key: str(undefined, { example: 'ABC-123' }),
            fields: { type: 'object', additionalProperties: true, description: 'Jira `fields` payload (see /api/jira/edit-meta for what is editable).' },
          },
        }),
        responses: { '200': jsonOk('Jira response', { type: 'object', additionalProperties: true }), ...jiraErrors },
      },
    },
    '/api/jira/edit-meta': {
      get: {
        tags: ['Issues'],
        summary: 'Get editable fields of an issue',
        parameters: [query('key', { type: 'string' }, 'Issue key.', true)],
        responses: { '200': jsonOk('Jira editmeta', { type: 'object', additionalProperties: true }), ...jiraErrors },
      },
    },
    '/api/jira/transitions': {
      get: {
        tags: ['Issues'],
        summary: 'List available workflow transitions of an issue',
        parameters: [query('key', { type: 'string' }, 'Issue key.', true)],
        responses: { '200': jsonOk('Jira transitions, including transition fields', { type: 'object', additionalProperties: true }), ...jiraErrors },
      },
      post: {
        tags: ['Issues'],
        summary: 'Transition an issue to another status',
        requestBody: jsonBody({
          type: 'object',
          required: ['key', 'transitionId'],
          properties: {
            key: str(),
            transitionId: str(),
            fields: { type: 'object', additionalProperties: true, description: 'Screen fields required by the transition (sanitized server-side).' },
          },
        }),
        responses: {
          '200': jsonOk('Transitioned', { type: 'object', properties: { success: { type: 'boolean' } } }),
          '400': errorResponse('`key` or `transitionId` is missing.'),
          '500': errorResponse('Jira request failed.'),
        },
      },
    },
    '/api/jira/log-work': {
      post: {
        tags: ['Worklog'],
        summary: 'Add a worklog to an issue',
        requestBody: jsonBody({
          type: 'object',
          required: ['issueKey', 'timeSpent'],
          properties: {
            issueKey: str(undefined, { example: 'ABC-123' }),
            timeSpent: str('Jira duration.', { example: '1h 30m' }),
            started: str('When the work started (local date-time).'),
            workDescription: str('Worklog comment.'),
            remainingEstimateType: { type: 'string', enum: ['auto', 'existing', 'set', 'reduce'] },
            remainingEstimate: str('Jira duration; used with `existing`, `set` and `reduce`.'),
          },
        }),
        responses: {
          '200': jsonOk('Created worklog (Jira response)', { type: 'object', additionalProperties: true }),
          '400': errorResponse('Missing `issueKey` / `timeSpent` or invalid `started`.'),
          '500': errorResponse('Jira request failed.'),
        },
      },
    },
    '/api/jira/hours-by-date': {
      get: {
        tags: ['Worklog'],
        summary: 'Logged hours per working day',
        description: 'Sums the current user\'s worklogs per day. Holidays are skipped, make-up days are included.',
        parameters: [
          query('from', { type: 'string', format: 'date' }, 'Range start.', true),
          query('to', { type: 'string', format: 'date' }, 'Range end.', true),
          query('selectedDate', { type: 'string', format: 'date' }, 'When set, returns the issues logged on that day instead.'),
          query('maxResults', { type: 'integer', default: 100 }, 'Page size for the `selectedDate` variant.'),
        ],
        responses: {
          '200': jsonOk('Hours per date', arrayOf({
            type: 'object',
            properties: { date: str(undefined, { format: 'date' }), hours: { type: 'number' } },
          })),
          '400': errorResponse('Missing or invalid `from` / `to`.'),
          '500': errorResponse('Jira request failed.'),
        },
      },
    },
    '/api/jira/projects': {
      get: {
        tags: ['Lookups'],
        summary: 'List projects',
        responses: { '200': jsonOk('Projects', arrayOf(ref('KeyName'))), ...jiraErrors },
      },
    },
    '/api/jira/issue-types': {
      get: {
        tags: ['Lookups'],
        summary: 'List issue types',
        responses: { '200': jsonOk('Issue types', arrayOf(ref('IdName'))), ...jiraErrors },
      },
    },
    '/api/jira/statuses': {
      get: {
        tags: ['Lookups'],
        summary: 'List distinct status names',
        responses: { '200': jsonOk('Statuses', arrayOf(ref('IdName'))), ...jiraErrors },
      },
    },
    '/api/jira/components': {
      get: {
        tags: ['Lookups'],
        summary: 'List components of a project',
        parameters: [query('project', { type: 'string' }, 'Project key. Without it an empty list is returned.')],
        responses: { '200': jsonOk('Components', arrayOf(ref('IdName'))), ...jiraErrors },
      },
    },
    '/api/jira/epics': {
      get: {
        tags: ['Lookups'],
        summary: 'Search epics of a project',
        parameters: [
          query('project', { type: 'string' }, 'Project key. Without it an empty list is returned.'),
          query('query', { type: 'string' }, 'Filter on key or summary.'),
        ],
        responses: { '200': jsonOk('Epics', arrayOf({ type: 'object', properties: { key: str(), summary: str() } })), ...jiraErrors },
      },
    },
    '/api/jira/tasks': {
      get: {
        tags: ['Lookups'],
        summary: 'Search issues of a project (for parent pickers)',
        parameters: [
          query('project', { type: 'string' }, 'Project key. Without it an empty list is returned.'),
          query('query', { type: 'string' }, 'Filter on key or summary.'),
        ],
        responses: { '200': jsonOk('Issues', arrayOf({ type: 'object', properties: { key: str(), summary: str() } })), ...jiraErrors },
      },
    },
    '/api/jira/sprints': {
      get: {
        tags: ['Lookups'],
        summary: 'List active and future sprints of a project',
        description: 'Active sprints come first. Returns an empty list when the Agile API is unavailable (401/404).',
        parameters: [
          query('project', { type: 'string' }, 'Project key. Without it an empty list is returned.'),
          query('query', { type: 'string' }, 'Filter on sprint name.'),
        ],
        responses: {
          '200': jsonOk('Sprints', arrayOf({
            type: 'object',
            properties: { id: str(), name: str(), state: { type: 'string', enum: ['active', 'future'] } },
          })),
          ...jiraErrors,
        },
      },
    },
    '/api/jira/users': {
      get: {
        tags: ['Lookups'],
        summary: 'Search users or list the whole directory',
        description: '`all=true` is restricted to same-origin requests, rate limited (429) and cached.',
        parameters: [
          query('query', { type: 'string' }, 'Username / name to search for (max 20 results).'),
          query('all', { type: 'boolean', default: false }, 'Return the complete user directory.'),
        ],
        responses: {
          '200': jsonOk('Users', arrayOf({ type: 'object', additionalProperties: true })),
          '403': errorResponse('`all=true` requested from a different origin.'),
          '429': errorResponse('Too many directory requests.'),
          '500': errorResponse('Jira request failed.'),
        },
      },
    },
    '/api/jira/avatar': {
      get: {
        tags: ['Lookups'],
        summary: 'Proxy a Jira avatar image',
        description: 'Fetches the image with server-side credentials. Only URLs on the configured Jira origin are allowed.',
        parameters: [query('src', { type: 'string', format: 'uri' }, 'Absolute avatar URL on the Jira host.', true)],
        responses: {
          '200': { description: 'Avatar image (cached for 24h)', content: { 'image/*': { schema: { type: 'string', format: 'binary' } } } },
          '400': errorResponse('Missing `src` or origin not allowed.'),
          '500': errorResponse('Failed to load avatar.'),
        },
      },
    },
    '/api/calendar/config': {
      get: {
        tags: ['Calendar'],
        summary: 'Read holidays and make-up working days',
        responses: {
          '200': jsonOk('Calendar config', {
            type: 'object',
            properties: { holidays: arrayOf(ref('CalendarEntry')), additionalDays: arrayOf(ref('CalendarEntry')) },
          }),
          '500': errorResponse('Cannot read the calendar files.'),
        },
      },
      post: {
        tags: ['Calendar'],
        summary: 'Add an entry',
        requestBody: jsonBody({
          type: 'object',
          required: ['type', 'entry'],
          properties: { type: ref('CalendarType'), entry: ref('CalendarEntry') },
        }),
        responses: { '200': jsonOk('Updated list of that type', ref('CalendarEntries')), '400': errorResponse('Invalid type or entry.') },
      },
      put: {
        tags: ['Calendar'],
        summary: 'Update an entry',
        requestBody: jsonBody({
          type: 'object',
          required: ['type', 'originalDate', 'entry'],
          properties: { type: ref('CalendarType'), originalDate: str('Date of the entry being replaced.', { format: 'date' }), entry: ref('CalendarEntry') },
        }),
        responses: { '200': jsonOk('Updated list of that type', ref('CalendarEntries')), '400': errorResponse('Invalid type or entry.') },
      },
      delete: {
        tags: ['Calendar'],
        summary: 'Delete an entry',
        parameters: [
          query('type', ref('CalendarType'), 'Which list to modify.', true),
          query('date', { type: 'string', format: 'date' }, 'Date of the entry to delete.', true),
        ],
        responses: { '200': jsonOk('Updated list of that type', ref('CalendarEntries')), '400': errorResponse('Invalid type or unknown date.') },
      },
    },
    '/api/calendar/vn-working-days': {
      get: {
        tags: ['Calendar'],
        summary: 'Number of working days in a month',
        parameters: [
          query('year', { type: 'integer' }, 'Defaults to the current year.'),
          query('month', { type: 'integer', minimum: 1, maximum: 12 }, 'Defaults to the current month.'),
        ],
        responses: {
          '200': jsonOk('Working-day summary', {
            type: 'object',
            properties: {
              year: { type: 'integer' },
              month: { type: 'integer' },
              holidayDates: arrayOf(str(undefined, { format: 'date' })),
              additionalDates: arrayOf(str(undefined, { format: 'date' })),
              workingDays: { type: 'integer' },
              source: { type: 'string', enum: ['local-calendar-json', 'fallback'], description: '`fallback` means the calendar files could not be read.' },
            },
          }),
          '400': errorResponse('Invalid year or month.'),
        },
      },
    },
  },
  components: {
    schemas: {
      Error: { type: 'object', properties: { error: { type: 'string' } }, required: ['error'] },
      KeyName: { type: 'object', properties: { key: { type: 'string' }, name: { type: 'string' } } },
      IdName: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' } } },
      CalendarType: { type: 'string', enum: ['holiday', 'additional'], description: '`holiday` = day off, `additional` = make-up working day.' },
      CalendarEntry: {
        type: 'object',
        required: ['date', 'name'],
        properties: { date: { type: 'string', format: 'date' }, name: { type: 'string' } },
      },
      CalendarEntries: { type: 'object', properties: { entries: arrayOf(ref('CalendarEntry')) } },
      TaskSummary: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          summary: { type: 'string' },
          status: { type: 'string' },
          issuetype: { type: 'string' },
          assignee: { type: 'string' },
          priority: { type: 'string' },
          description: { type: 'string', description: 'First 10 words.' },
          originalEstimate: { type: 'string', example: '1d 4h' },
          remaining: { type: 'string' },
          logged: { type: 'string' },
          startDate: { type: 'string' },
          dueDate: { type: 'string' },
          resolutionDate: { type: 'string' },
        },
      },
      TaskPage: {
        type: 'object',
        properties: {
          issues: arrayOf(ref('TaskSummary')),
          total: { type: 'integer' },
          startAt: { type: 'integer' },
          maxResults: { type: 'integer' },
          fullIssues: { type: 'object', additionalProperties: true, description: 'Only when `full=true`.' },
        },
      },
    },
  },
} as const;
