import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import https from 'https';
import { JiraIssue, JiraIssueType, JiraPriority, JiraResolution, JiraSprint, JiraStatus, JiraUser } from '@/types/jira';
import { buildWorklogAuthorJql, readProfileEmailFromRequestCookieHeader } from './profileAuthor.js';
import { getJiraErrorDetails } from '@/lib/jira/apiError.js';

interface JiraNamedValue {
  name?: string;
  value?: string;
  displayName?: string;
}

interface JiraPagedResponse<T> {
  issues?: T[];
  total?: number;
  startAt?: number;
  maxResults?: number;
}

interface JiraWorklog {
  author?: JiraNamedValue;
  timeSpentSeconds?: number;
  started?: string;
}

type JiraUnknownFields = Record<string, unknown>;

interface JiraIssueTypePayload extends JiraIssueType {
  [key: string]: unknown;
}

type JiraFullIssue = Omit<JiraIssue, 'fields'> & {
  fields: Omit<JiraIssue['fields'], 'created' | 'updated' | 'timeestimate' | 'timespent' | 'timeoriginalestimate'> & {
    created: string | null;
    updated: string | null;
    timeestimate: string | number | null;
    timespent: string | number | null;
    timeoriginalestimate: string | number | null;
  };
};

interface JiraIssueFields extends JiraUnknownFields {
  summary?: string;
  status?: JiraStatus;
  assignee?: JiraUser | null;
  reporter?: JiraUser | null;
  priority?: JiraPriority | null;
  issuetype?: JiraIssueTypePayload;
  timeestimate?: string | number | null;
  timespent?: string | number | null;
  timeoriginalestimate?: string | number | null;
  startdate?: string | null;
  duedate?: string | null;
  resolutiondate?: string | null;
  created?: string | null;
  updated?: string | null;
  labels?: string[];
  sprint?: JiraSprint | null;
  resolution?: JiraResolution | null;
  description?: string | null;
  subtasks?: JiraIssue[];
  worklog?: { worklogs?: JiraWorklog[] };
}

interface JiraIssuePayload {
  id?: string;
  key?: string;
  fields?: JiraIssueFields;
}

function isRecord(value: unknown): value is JiraUnknownFields {
  return typeof value === 'object' && value !== null;
}

function getEpic(link: unknown, epic: unknown): JiraFullIssue['fields']['epic'] {
  if (link) return { key: '', fields: { name: '', color: '' } };

  const epicRecord = isRecord(epic) ? epic : null;
  const epicFields = isRecord(epicRecord?.fields) ? epicRecord.fields : null;
  if (!epicRecord) return null;

  return {
    key: typeof epicRecord.key === 'string' ? epicRecord.key : '',
    fields: {
      name: typeof epicFields?.name === 'string' ? epicFields.name : '',
      color: typeof epicFields?.color === 'string' ? epicFields.color : '',
    },
  };
}

function getParent(parent: unknown): JiraFullIssue['fields']['parent'] {
  const parentRecord = isRecord(parent) ? parent : null;
  const parentFields = isRecord(parentRecord?.fields) ? parentRecord.fields : null;
  if (!parentRecord) return null;

  return {
    key: typeof parentRecord.key === 'string' ? parentRecord.key : '',
    fields: { summary: typeof parentFields?.summary === 'string' ? parentFields.summary : '' },
  };
}

const httpsAgent = new https.Agent({
  rejectUnauthorized: (process.env.JIRA_SKIP_TLS === 'true') ? false : true,
});

function getAuthHeaders(): Record<string, string> {
  const bearerToken = (process.env.JIRA_BEARER_TOKEN || '').replace(/^["']|["']$/g, '').trim();
  const email = (process.env.JIRA_EMAIL || '').replace(/^["']|["']$/g, '').trim();
  const apiToken = (process.env.JIRA_API_TOKEN || '').replace(/^["']|["']$/g, '').trim();

  if (bearerToken) {
    return {
      Authorization: `Bearer ${bearerToken}`,
      'Content-Type': 'application/json',
    };
  }

  if (email && apiToken) {
    const credentials = Buffer.from(`${email}:${apiToken}`).toString('base64');
    return {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/json',
    };
  }

  throw new Error('Jira credentials not configured. Set JIRA_BEARER_TOKEN or JIRA_EMAIL+JIRA_API_TOKEN');
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function toLocalDateStr(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function isWorkingDay(d: Date) {
  const dow = d.getDay();
  return dow !== 0 && dow !== 6;
}

function formatVNDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch {
    return '-';
  }
}

export async function GET(request: NextRequest) {
  try {
    const baseUrl = (process.env.JIRA_BASE_URL || '').replace(/\/+$/, '');
    if (!baseUrl) {
      throw new Error('JIRA_BASE_URL is not configured');
    }

    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const selectedDate = searchParams.get('selectedDate');
    const maxResults = parseInt(searchParams.get('maxResults') || '100');
    const profileEmail = readProfileEmailFromRequestCookieHeader(request.headers.get('cookie'));
    const worklogAuthorClause = buildWorklogAuthorJql(profileEmail);

    const axiosInstance = axios.create({
      baseURL: baseUrl,
      httpsAgent,
      timeout: 60000,
    });

    if (selectedDate) {
      const dateStart = new Date(`${selectedDate}T00:00:00`);
      const dateEnd = new Date(`${selectedDate}T23:59:59`);

      const allWorklogIssues: JiraIssuePayload[] = [];
      let startAt = 0;
      let hasFetched = false;
      let totalIssues = 0;

      while ((!hasFetched || allWorklogIssues.length < totalIssues) && allWorklogIssues.length < 2000) {
        const response = await axiosInstance.post<JiraPagedResponse<JiraIssuePayload>>('/rest/api/2/search', {
          jql: worklogAuthorClause,
          fields: ['summary', 'status', 'issuetype', 'priority', 'assignee', 'timeestimate', 'timeoriginalestimate', 'timespent', 'worklog', 'duedate', 'resolutiondate', 'created', 'updated', 'labels', 'sprint', 'epic', 'resolution', 'startdate', 'customfield_10300', 'customfield_10302', 'reporter', 'parent', 'description'],
          startAt,
          maxResults,
        }, {
          headers: getAuthHeaders(),
        });

      const responseData = response.data;
      const issuePage = responseData.issues;
      if (!Array.isArray(issuePage)) {
        throw new Error('Jira search response is missing an issues array');
      }
      totalIssues = responseData.total || 0;
        if (issuePage.length === 0 && allWorklogIssues.length < totalIssues) {
          throw new Error('Jira search response returned an empty page before total');
        }
        allWorklogIssues.push(...issuePage);
        startAt += maxResults;
        hasFetched = true;
        if (allWorklogIssues.length >= 2000) break;
      }

      const issuesWithWorklogsOnDate = allWorklogIssues.filter((issue) => {
        const worklogs = issue.fields?.worklog?.worklogs || [];
        return worklogs.some((wl) => {
          const started = new Date(wl.started || '');
          return started >= dateStart && started <= dateEnd;
        });
      });

      const issues = issuesWithWorklogsOnDate.map((issue) => ({
        key: issue.key || '',
        id: issue.id || '',
        summary: issue.fields?.summary || '',
        status: issue.fields?.status?.name || 'Unknown',
        assignee: issue.fields?.assignee?.displayName || '',
        priority: issue.fields?.priority?.name || 'None',
        issuetype: issue.fields?.issuetype?.name || 'Issue',
        estimated: (() => {
          const val = issue.fields?.timeoriginalestimate;
          if (!val) return '0h';
          const seconds = typeof val === 'string' ? parseInt(val) : val;
          const hours = seconds / 3600;
          const days = Math.floor(hours / 24);
          const dayHours = Math.floor(hours % 24);
          const minutes = Math.round((hours % 1) * 60);
          const parts: string[] = [];
          if (days > 0) parts.push(`${days}d`);
          if (dayHours > 0) parts.push(`${dayHours}h`);
          if (minutes > 0) parts.push(`${minutes}m`);
          return parts.join(' ') || '0h';
        })(),
        originalEstimate: (() => {
          const val = issue.fields?.timeestimate;
          if (!val) return '0h';
          const seconds = typeof val === 'string' ? parseInt(val) : val;
          const hours = seconds / 3600;
          const days = Math.floor(hours / 24);
          const dayHours = Math.floor(hours % 24);
          const minutes = Math.round((hours % 1) * 60);
          const parts: string[] = [];
          if (days > 0) parts.push(`${days}d`);
          if (dayHours > 0) parts.push(`${dayHours}h`);
          if (minutes > 0) parts.push(`${minutes}m`);
          return parts.join(' ') || '0h';
        })(),
        logged: (() => {
          const val = issue.fields?.timespent;
          if (!val) return '0h';
          const seconds = typeof val === 'string' ? parseInt(val) : val;
          const hours = seconds / 3600;
          const days = Math.floor(hours / 24);
          const dayHours = Math.floor(hours % 24);
          const minutes = Math.round((hours % 1) * 60);
          const parts: string[] = [];
          if (days > 0) parts.push(`${days}d`);
          if (dayHours > 0) parts.push(`${dayHours}h`);
          if (minutes > 0) parts.push(`${minutes}m`);
          return parts.join(' ') || '0h';
        })(),
        resolutionDate: formatVNDate(issue.fields?.resolutiondate),
        created: formatVNDate(issue.fields?.created),
        updated: formatVNDate(issue.fields?.updated),
        sprint: issue.fields?.sprint?.name || '-',
        epic: (() => {
          const epic = issue.fields?.['epic-link'];
          if (epic) {
            const record = isRecord(epic) ? epic : null;
            const fields = isRecord(record?.fields) ? record.fields : null;
            return typeof fields?.name === 'string' ? fields.name : typeof record?.key === 'string' ? record.key : String(epic);
          }
          return '-';
        })(),
        labels: issue.fields?.labels || [],
        resolution: issue.fields?.resolution?.name || '-',
        startDate: formatVNDate(issue.fields?.startdate || (typeof issue.fields?.customfield_10300 === 'string' ? issue.fields.customfield_10300 : null)),
        dueDate: formatVNDate(issue.fields?.duedate || (typeof issue.fields?.customfield_10302 === 'string' ? issue.fields.customfield_10302 : null)),
      }));

      const fullIssues: Record<string, JiraFullIssue> = {};
      for (const issue of issuesWithWorklogsOnDate) {
        const fields = issue.fields;
        fullIssues[issue.key || ''] = {
          id: issue.id || '',
          key: issue.key || '',
          fields: {
            summary: fields?.summary || '',
            status: fields?.status || { id: '', name: 'Unknown', category: '' },
            assignee: fields?.assignee || null,
            reporter: fields?.reporter || null,
            priority: fields?.priority || null,
            issuetype: fields?.issuetype || { name: 'Issue', iconUrl: '' },
            timeestimate: fields?.timeestimate ?? null,
            timespent: fields?.timespent ?? null,
            timeoriginalestimate: fields?.timeoriginalestimate ?? null,
            startdate: formatVNDate(fields?.startdate || (typeof fields?.customfield_10300 === 'string' ? fields.customfield_10300 : null)),
            duedate: formatVNDate(fields?.duedate || (typeof fields?.customfield_10302 === 'string' ? fields.customfield_10302 : null)),
            resolutiondate: formatVNDate(fields?.resolutiondate),
            created: formatVNDate(fields?.created),
            updated: formatVNDate(fields?.updated),
            labels: fields?.labels || [],
            sprint: fields?.sprint || null,
            resolution: fields?.resolution || null,
            description: fields?.description || null,
            epic: getEpic(fields?.['epic-link'], fields?.epic),
            parent: getParent(fields?.parent),
            subtasks: fields?.subtasks || [],
            issuekey: issue.key || '',
          },
        };
      }

      return NextResponse.json({ issues, fullIssues });
    }

    if (!from || !to) {
      return NextResponse.json(
        { error: 'Missing required parameters: from, to' },
        { status: 400 }
      );
    }

    const fromStart = new Date(`${from}T00:00:00`);
    const toEnd = new Date(`${to}T23:59:59`);

    const jql = `${worklogAuthorClause} ORDER BY updated DESC`;

    const allIssues: JiraIssuePayload[] = [];
    let startAt = 0;
    const maxApiResults = 100;
    let totalIssues = 0;
    let hasFetched = false;

    while ((!hasFetched || allIssues.length < totalIssues) && allIssues.length < 2000) {
      const response = await axiosInstance.post<JiraPagedResponse<JiraIssuePayload>>('/rest/api/2/search', {
        jql,
        fields: ['worklog'],
        startAt,
        maxResults: maxApiResults,
      }, {
        headers: getAuthHeaders(),
      });

        const responseData = response.data;
        const issuePage = responseData.issues;
        if (!Array.isArray(issuePage)) {
          throw new Error('Jira search response is missing an issues array');
        }
        totalIssues = responseData.total || 0;
      if (issuePage.length === 0 && allIssues.length < totalIssues) {
        throw new Error('Jira search response returned an empty page before total');
      }
      allIssues.push(...issuePage);
      startAt += maxApiResults;
      hasFetched = true;
    }

    const dailyHours = new Map<string, number>();

    for (let d = new Date(fromStart); d <= toEnd; d.setDate(d.getDate() + 1)) {
      if (isWorkingDay(d)) {
        dailyHours.set(toLocalDateStr(d), 0);
      }
    }

    for (const issue of allIssues) {
      const worklogs = issue.fields?.worklog?.worklogs || [];
      for (const wl of worklogs) {
        const wlStarted = new Date(wl.started || '');
        if (wlStarted >= fromStart && wlStarted <= toEnd) {
          const startedDate = toLocalDateStr(wlStarted);
          const seconds = wl.timeSpentSeconds || 0;
          const current = dailyHours.get(startedDate) || 0;
          dailyHours.set(startedDate, current + seconds);
        }
      }
    }

    const result = Array.from(dailyHours.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, seconds]) => ({
        date,
        hours: Math.round((seconds / 3600) * 100) / 100,
      }));

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error('Hours-by-date API error:', error);
    const { status, detail } = getJiraErrorDetails(error);
    const message = `Jira API error (${status}): ${JSON.stringify(detail)}`;
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
