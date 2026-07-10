import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import https from 'https';
import { JiraIssue } from '@/types/jira';
import { buildDateClauses } from '../work-tasks/dateField.js';

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

    const countRes = await axiosInstance.post('/rest/api/2/search', {
      jql,
      fields: ['summary'],
      maxResults: 1,
    }, { headers: getAuthHeaders() });

    const total = countRes.data.total || 0;

    const fullFields = ['summary', 'status', 'issuetype', 'description', 'timeoriginalestimate', 'timeestimate', 'timespent', 'assignee', 'priority', 'duedate', 'startDate', 'resolutiondate', 'created', 'updated', 'labels', 'reporter', 'sprint', 'epic', 'parent', 'resolution', 'customfield_10300', 'customfield_10302'];
    const searchRes = await axiosInstance.post('/rest/api/2/search', {
      jql,
      fields: includeFull ? fullFields : ['summary', 'status', 'issuetype', 'description', 'timeoriginalestimate', 'timeestimate', 'timespent', 'assignee', 'priority', 'duedate', 'startDate', 'resolutiondate', 'customfield_10300', 'customfield_10302'],
      startAt,
      maxResults,
    }, { headers: getAuthHeaders() });

    const rawIssues: any[] = searchRes.data.issues || [];

    const buildFullIssuesMap = (issues: any[]): Record<string, JiraIssue> => {
      const map: Record<string, JiraIssue> = {};
      issues.forEach((issue: any) => {
        try {
          const issueObj: JiraIssue = {
            id: issue.id,
            key: issue.key,
            fields: {
              summary: issue.fields.summary || '',
              status: issue.fields.status || { id: '', name: 'Unknown', category: '' },
              assignee: issue.fields.assignee || null,
              reporter: issue.fields.reporter || null,
              priority: issue.fields.priority || null,
              issuetype: issue.fields.issuetype || { name: 'Issue', iconUrl: '' },
              timeestimate: typeof issue.fields.timeestimate === 'string' ? issue.fields.timeestimate : issue.fields.timeestimate ? String(issue.fields.timeestimate) : null,
              timespent: typeof issue.fields.timespent === 'string' ? issue.fields.timespent : issue.fields.timespent ? String(issue.fields.timespent) : null,
              timeoriginalestimate: typeof issue.fields.timeoriginalestimate === 'string' ? issue.fields.timeoriginalestimate : issue.fields.timeoriginalestimate ? String(issue.fields.timeoriginalestimate) : null,
              startdate: issue.fields.startDate || issue.fields.customfield_10300 || null,
              customfield_10300: issue.fields.customfield_10300 || null,
              duedate: issue.fields.duedate || issue.fields.customfield_10302 || null,
              customfield_10302: issue.fields.customfield_10302 || null,
              resolutiondate: issue.fields.resolutiondate || null,
              created: issue.fields.created || null,
              updated: issue.fields.updated || null,
              labels: issue.fields.labels || [],
              sprint: issue.fields.sprint || null,
              resolution: issue.fields.resolution || null,
              description: issue.fields.description || null,
              epic: issue.fields['epic-link'] ? { key: '', fields: { name: '', color: '' } } : (issue.fields.epic ? { key: issue.fields.epic.key || '', fields: { name: issue.fields.epic.fields?.name || '', color: issue.fields.epic.fields?.color || '' } } : null),
              parent: issue.fields.parent ? { key: issue.fields.parent.key || '', fields: { summary: issue.fields.parent.fields?.summary || '' } } : null,
              subtasks: issue.fields.subtasks || [],
              issuekey: issue.key,
            },
          };
          map[issue.key] = issueObj;
        } catch {
          // skip
        }
      });
      return map;
    };

    const issues = rawIssues.map((issue: any) => {
      const getDesc = (d: string | null): string => {
        if (!d) return '';
        return d.trim().split(/\s+/).slice(0, 10).join(' ');
      };

      const formatTime = (val: string | null | number): string => {
        if (val === null || val === 0 || val === 'null') return '0h';
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
        key: issue.key,
        summary: issue.fields.summary || '',
        status: issue.fields.status.name || 'Unknown',
        issuetype: issue.fields.issuetype.name || 'Issue',
        assignee: issue.fields.assignee?.displayName || '',
        priority: issue.fields.priority?.name || 'None',
        description: getDesc(issue.fields.description),
        originalEstimate: formatTime(issue.fields.timeoriginalestimate),
        remaining: formatTime(issue.fields.timeestimate),
        logged: formatTime(issue.fields.timespent),
        startDate: formatVNDate(issue.fields.startDate || issue.fields.customfield_10300),
        dueDate: formatVNDate(issue.fields.duedate || issue.fields.customfield_10302),
        resolutionDate: formatVNDate(issue.fields.resolutiondate),
      };
    });

    const response: any = {
      issues,
      total,
      startAt,
      maxResults,
    };

    if (includeFull) {
      response.fullIssues = buildFullIssuesMap(rawIssues);
    }

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Browse tasks API error:', error);
    const status = error.response?.status || error.code || 'UNKNOWN';
    const detail = error.response?.data || error.message || 'Unknown error';
    return NextResponse.json(
      { error: `Jira API error (${status}): ${JSON.stringify(detail)}` },
      { status: 500 }
    );
  }
}
