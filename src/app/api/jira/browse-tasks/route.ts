import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import https from 'https';
import { JiraIssue, JiraIssueType, JiraPriority, JiraResolution, JiraSprint, JiraStatus, JiraUser } from '@/types/jira';
import { buildDateClauses } from '../work-tasks/dateField.js';
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
  startDate?: string | null;
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
  if (link) {
    return { key: '', fields: { name: '', color: '' } };
  }

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

function toStringOrNull(value: string | number | null | undefined): string | null {
  return typeof value === 'string' ? value : typeof value === 'number' && value ? String(value) : null;
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

  throw new Error('Jira credentials not configured');
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
    const searchText = searchParams.get('search') || '';
    const projectKey = searchParams.get('project');
    const issueType = searchParams.get('issueType');
    const statuses = searchParams.getAll('status').filter(Boolean);
    const assignee = searchParams.get('assignee');
    const startFrom = searchParams.get('startFrom');
    const startTo = searchParams.get('startTo');
    const startAt = parseInt(searchParams.get('startAt') || '0');
    const maxResults = parseInt(searchParams.get('maxResults') || '1000');
    const includeFull = searchParams.get('full') === 'true';

    const axiosInstance = axios.create({
      baseURL: baseUrl,
      httpsAgent,
      timeout: 30000,
    });

    const clauses: string[] = [];

    if (searchText) {
      const escaped = searchText.replace(/"/g, '\\"');
      clauses.push(`summary ~ "${escaped}"`);
    }

    if (projectKey) {
      clauses.push(`project = ${projectKey}`);
    }

    if (issueType) {
      clauses.push(`issuetype = "${issueType.replace(/"/g, '\\"')}"`);
    }

    if (statuses.length > 0) {
      clauses.push(`status in (${statuses.map((s) => `"${s.replace(/"/g, '\\"')}"`).join(', ')})`);
    }

    if (assignee) {
      clauses.push(`assignee = "${assignee.replace(/"/g, '\\"')}"`);
    }

    const { clauses: dateClauses, orderBy } = buildDateClauses({ from: startFrom, to: startTo, dateField: 'startDate' });
    clauses.push(...dateClauses);

    const jql = clauses.length > 0
      ? `${clauses.join(' AND ')} ORDER BY ${orderBy}`
      : `ORDER BY ${orderBy}`;

    const countRes = await axiosInstance.post<JiraPagedResponse<JiraIssuePayload>>('/rest/api/2/search', {
      jql,
      fields: ['summary'],
      maxResults: 1,
    }, { headers: getAuthHeaders() });

    const total = countRes.data.total || 0;

    const fullFields = ['summary', 'status', 'issuetype', 'description', 'timeoriginalestimate', 'timeestimate', 'timespent', 'assignee', 'priority', 'duedate', 'startDate', 'resolutiondate', 'created', 'updated', 'labels', 'reporter', 'sprint', 'epic', 'parent', 'resolution', 'customfield_10300', 'customfield_10302'];
    const searchRes = await axiosInstance.post<JiraPagedResponse<JiraIssuePayload>>('/rest/api/2/search', {
      jql,
      fields: includeFull ? fullFields : ['summary', 'status', 'issuetype', 'description', 'timeoriginalestimate', 'timeestimate', 'timespent', 'assignee', 'priority', 'duedate', 'startDate', 'resolutiondate', 'customfield_10300', 'customfield_10302'],
      startAt,
      maxResults,
    }, { headers: getAuthHeaders() });

    const rawIssues = searchRes.data.issues || [];

    const buildFullIssuesMap = (issues: JiraIssuePayload[]): Record<string, JiraFullIssue> => {
      const map: Record<string, JiraFullIssue> = {};
      issues.forEach((issue) => {
        try {
          const fields = issue.fields;
          const issueObj: JiraFullIssue = {
            id: issue.id || '',
            key: issue.key || '',
            fields: {
              summary: fields?.summary || '',
              status: fields?.status || { id: '', name: 'Unknown', category: '' },
              assignee: fields?.assignee || null,
              reporter: fields?.reporter || null,
              priority: fields?.priority || null,
              issuetype: fields?.issuetype || { name: 'Issue', iconUrl: '' },
              timeestimate: toStringOrNull(fields?.timeestimate),
              timespent: toStringOrNull(fields?.timespent),
              timeoriginalestimate: toStringOrNull(fields?.timeoriginalestimate),
              startdate: fields?.startDate || (typeof fields?.customfield_10300 === 'string' ? fields.customfield_10300 : null),
              customfield_10300: typeof fields?.customfield_10300 === 'string' ? fields.customfield_10300 : null,
              duedate: fields?.duedate || (typeof fields?.customfield_10302 === 'string' ? fields.customfield_10302 : null),
              customfield_10302: typeof fields?.customfield_10302 === 'string' ? fields.customfield_10302 : null,
              resolutiondate: fields?.resolutiondate || null,
              created: fields?.created || null,
              updated: fields?.updated || null,
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
          map[issue.key || ''] = issueObj;
        } catch {
          // skip
        }
      });
      return map;
    };

    const issues = rawIssues.map((issue) => {
      const getDesc = (d: string | null | undefined): string => {
        if (!d) return '';
        return d.trim().split(/\s+/).slice(0, 10).join(' ');
      };

      const formatTime = (val: string | null | number | undefined): string => {
        if (val === null || val === undefined || val === 0 || val === 'null') return '0h';
        const seconds = typeof val === 'number' ? val : parseInt(val);
        const hours = seconds / 3600;
        const days = Math.floor(hours / 24);
        const dayHours = Math.floor(hours % 24);
        const minutes = Math.round((hours % 1) * 60);
        const parts: string[] = [];
        if (days > 0) parts.push(`${days}d`);
        if (dayHours > 0) parts.push(`${dayHours}h`);
        if (minutes > 0) parts.push(`${minutes}m`);
        return parts.length > 0 ? parts.join(' ') : '0h';
      };

      return {
        key: issue.key || '',
        summary: issue.fields?.summary || '',
        status: issue.fields?.status?.name || 'Unknown',
        issuetype: issue.fields?.issuetype?.name || 'Issue',
        assignee: issue.fields?.assignee?.displayName || '',
        priority: issue.fields?.priority?.name || 'None',
        description: getDesc(issue.fields?.description),
        originalEstimate: formatTime(issue.fields?.timeoriginalestimate),
        remaining: formatTime(issue.fields?.timeestimate),
        logged: formatTime(issue.fields?.timespent),
        startDate: formatVNDate(issue.fields?.startDate || (typeof issue.fields?.customfield_10300 === 'string' ? issue.fields.customfield_10300 : null)),
        dueDate: formatVNDate(issue.fields?.duedate || (typeof issue.fields?.customfield_10302 === 'string' ? issue.fields.customfield_10302 : null)),
        resolutionDate: formatVNDate(issue.fields?.resolutiondate),
      };
    });

    const response: { issues: typeof issues; total: number; startAt: number; maxResults: number; fullIssues?: Record<string, JiraFullIssue> } = {
      issues,
      total,
      startAt,
      maxResults,
    };

    if (includeFull) {
      response.fullIssues = buildFullIssuesMap(rawIssues);
    }

    return NextResponse.json(response);
  } catch (error: unknown) {
    console.error('Browse tasks API error:', error);
    const { status, detail } = getJiraErrorDetails(error);
    return NextResponse.json(
      { error: `Jira API error (${status}): ${JSON.stringify(detail)}` },
      { status: 500 }
    );
  }
}
