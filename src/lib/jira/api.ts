import { JiraSearchResponse, JiraIssue, JiraGroupedData, DashboardIssue } from '@/types/jira';
import axios from 'axios';
import https from 'https';
import { getJiraErrorDetails } from '@/lib/jira/apiError.js';

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

export async function getSavedQueryJQL(savedQueryId: string): Promise<string> {
  const baseUrl = (process.env.JIRA_BASE_URL || '').replace(/\/+$/, '');

  if (!baseUrl) {
    throw new Error('JIRA_BASE_URL is not configured');
  }

  const axiosInstance = axios.create({
    baseURL: baseUrl,
    httpsAgent,
    timeout: 30000,
  });

  try {
    const response = await axiosInstance.get(`/rest/api/2/filter/${savedQueryId}`, {
      headers: getAuthHeaders(),
    });
    return response.data.jql;
  } catch (error: unknown) {
    const { status, detail } = getJiraErrorDetails(error);
    const message = `Jira API error fetching saved query (${status}): ${JSON.stringify(detail)}`;
    console.error('Jira Saved Query Error:', message);
    throw new Error(message);
  }
}

export async function searchJiraByJQL(jql: string, startAt: number = 0, maxResults: number = 50, fields: string[] = ['*all']): Promise<JiraSearchResponse> {
  const baseUrl = (process.env.JIRA_BASE_URL || '').replace(/\/+$/, '');

  if (!baseUrl) {
    throw new Error('JIRA_BASE_URL is not configured');
  }

  const axiosInstance = axios.create({
    baseURL: baseUrl,
    httpsAgent,
    timeout: 30000,
  });

  try {
    const response = await axiosInstance.post('/rest/api/2/search', {
      jql,
      fields,
      startAt,
      maxResults,
    }, {
      headers: getAuthHeaders(),
    });

    return response.data as JiraSearchResponse;
  } catch (error: unknown) {
    const { status, detail } = getJiraErrorDetails(error);
    const message = `Jira API error (${status}): ${JSON.stringify(detail)}`;
    console.error('Jira API Error:', message);
    throw new Error(message);
  }
}

export async function getJiraIssueByKey(
  key: string,
  fields: string[] = ['*all'],
): Promise<JiraIssue> {
  const baseUrl = (process.env.JIRA_BASE_URL || '').replace(/\/+$/, '');

  if (!baseUrl) {
    throw new Error('JIRA_BASE_URL is not configured');
  }

  const axiosInstance = axios.create({
    baseURL: baseUrl,
    httpsAgent,
    timeout: 30000,
  });

  try {
    const response = await axiosInstance.get(`/rest/api/2/issue/${key}`, {
      headers: getAuthHeaders(),
      params: { fields: fields.join(',') },
    });

    return response.data as JiraIssue;
  } catch (error: unknown) {
    const { status, detail } = getJiraErrorDetails(error);
    const message = `Jira API error fetching issue ${key} (${status}): ${JSON.stringify(detail)}`;
    console.error('Jira Issue Error:', message);
    throw new Error(message);
  }
}

function getAssigneeName(issue: JiraIssue): string {
  const assignee = issue.fields.assignee;
  if (!assignee) return 'Unassigned';
  return assignee.displayName || assignee.name || 'Unassigned';
}

function getSprintName(issue: JiraIssue): string {
  if (issue.fields.sprint) {
    return issue.fields.sprint.name;
  }
  return 'No Sprint';
}

function getPriorityName(issue: JiraIssue): string {
  if (!issue.fields.priority) return 'None';
  return issue.fields.priority.name || 'None';
}

function getIssueType(issue: JiraIssue): string {
  return issue.fields.issuetype.name || 'Issue';
}

function getEpicName(issue: JiraIssue): string {
  if (issue.fields.epic) {
    return issue.fields.epic.fields.name || 'No Epic';
  }
  return 'No Epic';
}

function getResolutionName(issue: JiraIssue): string {
  if (!issue.fields.resolution) return 'Unresolved';
  return issue.fields.resolution.name || 'Unresolved';
}

function getOriginalEstimate(issue: JiraIssue): string {
  if (issue.fields.timeoriginalestimate) {
    return formatTime(parseInt(issue.fields.timeoriginalestimate));
  }
  return '0h';
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB');
}

function formatTime(seconds: number | null): string {
  if (seconds === null || seconds === 0) return '0h';
  const hours = seconds / 3600;
  const days = Math.floor(hours / 24);
  const dayHours = Math.floor(hours % 24);
  const minutes = Math.round((hours % 1) * 60);
  
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (dayHours > 0) parts.push(`${dayHours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  
  return parts.length > 0 ? parts.join(' ') : '0h';
}

function looksLikeIssueKey(value: string | undefined): boolean {
  return /^[A-Z][A-Z0-9_]+-\d+$/.test(value || '');
}

function getIssueKey(issue: JiraIssue): string {
  const summary = issue.fields.summary || issue.summary || '';

  return issue.issuekey || issue.issueKey || issue.fields.issuekey || issue.fields.issueKey || issue.key || (looksLikeIssueKey(summary) ? summary : '');
}

function getIssueSummary(issue: JiraIssue): string {
  const summary = issue.fields.summary || issue.summary || '';
  return looksLikeIssueKey(summary) ? '' : summary;
}

function getStartDate(issue: JiraIssue): string | null {
  return issue.fields.startdate || issue.fields.customfield_10300 || null;
}

function getDueDate(issue: JiraIssue): string | null {
  return issue.fields.duedate || issue.fields.customfield_10302 || null;
}

export function mapIssuesToDashboard(issues: JiraIssue[]): DashboardIssue[] {
  return issues.map((issue) => ({
    key: getIssueKey(issue),
    id: issue.id,
    summary: getIssueSummary(issue),
    status: issue.fields.status.name || 'Unknown',
    assignee: getAssigneeName(issue),
    priority: getPriorityName(issue),
    issuetype: getIssueType(issue),
    estimated: formatTime(issue.fields.timeoriginalestimate ? parseInt(issue.fields.timeoriginalestimate) : null),
    originalEstimate: formatTime(issue.fields.timeestimate ? parseInt(issue.fields.timeestimate) : null),
    logged: formatTime(issue.fields.timespent ? parseInt(issue.fields.timespent) : null),
    resolutionDate: formatDateTime(issue.fields.resolutiondate),
    startDate: formatDateTime(getStartDate(issue)),
    dueDate: formatDateTime(getDueDate(issue)),
    created: formatDateTime(issue.fields.created),
    updated: formatDateTime(issue.fields.updated),
    sprint: getSprintName(issue),
    epic: getEpicName(issue),
    labels: issue.fields.labels || [],
    resolution: getResolutionName(issue),
  }));
}

export function aggregateByAssignee(issues: JiraIssue[]): JiraGroupedData[] {
  const aggregated = new Map<string, { estimated: number; logged: number }>();

  issues.forEach((issue) => {
    const assignee = getAssigneeName(issue);
    const estimated = (issue.fields.timeestimate ? parseInt(issue.fields.timeestimate) : (issue.fields.timeoriginalestimate ? parseInt(issue.fields.timeoriginalestimate) : 0));
    const logged = issue.fields.timespent ? parseInt(issue.fields.timespent) : 0;

    const current = aggregated.get(assignee) || { estimated: 0, logged: 0 };
    aggregated.set(assignee, {
      estimated: current.estimated + estimated,
      logged: current.logged + logged,
    });
  });

  return Array.from(aggregated.entries()).map(([label, values]) => ({
    label,
    estimatedSeconds: values.estimated,
    loggedSeconds: values.logged,
  }));
}

export function aggregateBySprint(issues: JiraIssue[]): JiraGroupedData[] {
  const aggregated = new Map<string, { estimated: number; logged: number }>();

  issues.forEach((issue) => {
    const sprint = getSprintName(issue);
    const estimated = (issue.fields.timeestimate ? parseInt(issue.fields.timeestimate) : (issue.fields.timeoriginalestimate ? parseInt(issue.fields.timeoriginalestimate) : 0));
    const logged = issue.fields.timespent ? parseInt(issue.fields.timespent) : 0;

    const current = aggregated.get(sprint) || { estimated: 0, logged: 0 };
    aggregated.set(sprint, {
      estimated: current.estimated + estimated,
      logged: current.logged + logged,
    });
  });

  return Array.from(aggregated.entries()).map(([label, values]) => ({
    label,
    estimatedSeconds: values.estimated,
    loggedSeconds: values.logged,
  }));
}

export function aggregateByStatus(issues: JiraIssue[]): JiraGroupedData[] {
  return aggregateByStatusWithOptions(issues);
}

export function aggregateByStatusWithOptions(
  issues: JiraIssue[],
  options: { mergeDoneResolved?: boolean } = {},
): JiraGroupedData[] {
  const aggregated = new Map<string, { estimated: number; logged: number }>();
  const mergeDoneResolved = options.mergeDoneResolved === true;

  issues.forEach((issue) => {
    const rawStatus = issue.fields.status.name || 'Unknown';
    const status = mergeDoneResolved && (rawStatus === 'Done' || rawStatus === 'Resolved' || rawStatus === 'Closed')
      ? 'Done / Resolved'
      : rawStatus;
    const estimated = (issue.fields.timeestimate ? parseInt(issue.fields.timeestimate) : (issue.fields.timeoriginalestimate ? parseInt(issue.fields.timeoriginalestimate) : 0));
    const logged = issue.fields.timespent ? parseInt(issue.fields.timespent) : 0;

    const current = aggregated.get(status) || { estimated: 0, logged: 0 };
    aggregated.set(status, {
      estimated: current.estimated + estimated,
      logged: current.logged + logged,
    });
  });

  return Array.from(aggregated.entries()).map(([label, values]) => ({
    label,
    estimatedSeconds: values.estimated,
    loggedSeconds: values.logged,
  }));
}

export function aggregateByEpic(issues: JiraIssue[]): JiraGroupedData[] {
  const aggregated = new Map<string, { estimated: number; logged: number }>();

  issues.forEach((issue) => {
    const epic = getEpicName(issue);
    const estimated = (issue.fields.timeestimate ? parseInt(issue.fields.timeestimate) : (issue.fields.timeoriginalestimate ? parseInt(issue.fields.timeoriginalestimate) : 0));
    const logged = issue.fields.timespent ? parseInt(issue.fields.timespent) : 0;

    const current = aggregated.get(epic) || { estimated: 0, logged: 0 };
    aggregated.set(epic, {
      estimated: current.estimated + estimated,
      logged: current.logged + logged,
    });
  });

  return Array.from(aggregated.entries()).map(([label, values]) => ({
    label,
    estimatedSeconds: values.estimated,
    loggedSeconds: values.logged,
  }));
}


