import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import https from 'https';

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

    const axiosInstance = axios.create({
      baseURL: baseUrl,
      httpsAgent,
      timeout: 60000,
    });

    if (selectedDate) {
      const dateStart = new Date(`${selectedDate}T00:00:00`);
      const dateEnd = new Date(`${selectedDate}T23:59:59`);

      const allWorklogIssues: any[] = [];
      let startAt = 0;
      let hasFetched = false;
      let totalIssues = 0;
      let response: any = null;

      while ((!hasFetched || allWorklogIssues.length < totalIssues) && allWorklogIssues.length < 2000) {
        response = await axiosInstance.post('/rest/api/2/search', {
          jql: 'worklogAuthor = currentUser()',
          fields: ['summary', 'status', 'issuetype', 'priority', 'assignee', 'timeestimate', 'timeoriginalestimate', 'timespent', 'worklog', 'duedate', 'resolutiondate', 'created', 'updated', 'labels', 'sprint', 'epic', 'resolution', 'startdate', 'customfield_10300', 'customfield_10302', 'reporter', 'parent', 'description'],
          startAt,
          maxResults,
        }, {
          headers: getAuthHeaders(),
        });

        const responseData = response.data as { issues: any[]; total: number };
        totalIssues = responseData.total || 0;
        allWorklogIssues.push(...responseData.issues);
        startAt += maxResults;
        hasFetched = true;
        if (allWorklogIssues.length >= 2000) break;
      }

      const issuesWithWorklogsOnDate = allWorklogIssues.filter((issue) => {
        const worklogs = issue.fields?.worklog?.worklogs || [];
        return worklogs.some((wl: any) => {
          const started = new Date(wl.started);
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
            return typeof epic === 'object' ? (epic.fields?.name || epic.key || '') : String(epic);
          }
          return '-';
        })(),
        labels: issue.fields?.labels || [],
        resolution: issue.fields?.resolution?.name || '-',
        startDate: formatVNDate(issue.fields?.startdate || issue.fields?.customfield_10300),
        dueDate: formatVNDate(issue.fields?.duedate || issue.fields?.customfield_10302),
      }));

      const fullIssues: Record<string, any> = {};
      for (const issue of issuesWithWorklogsOnDate) {
        fullIssues[issue.key] = {
          id: issue.id,
          key: issue.key,
          fields: {
            summary: issue.fields?.summary || '',
            status: issue.fields?.status || { id: '', name: 'Unknown', category: '' },
            assignee: issue.fields?.assignee || null,
            reporter: issue.fields?.reporter || null,
            priority: issue.fields?.priority || null,
            issuetype: issue.fields?.issuetype || { name: 'Issue', iconUrl: '' },
            timeestimate: issue.fields?.timeestimate || null,
            timespent: issue.fields?.timespent || null,
            timeoriginalestimate: issue.fields?.timeoriginalestimate || null,
            startdate: formatVNDate(issue.fields?.startdate || issue.fields?.customfield_10300),
            duedate: formatVNDate(issue.fields?.duedate || issue.fields?.customfield_10302),
            resolutiondate: formatVNDate(issue.fields?.resolutiondate),
            created: formatVNDate(issue.fields?.created),
            updated: formatVNDate(issue.fields?.updated),
            labels: issue.fields?.labels || [],
            sprint: issue.fields?.sprint || null,
            resolution: issue.fields?.resolution || null,
            description: issue.fields?.description || null,
            epic: issue.fields?.['epic-link'] ? { key: '', fields: { name: '', color: '' } } : (issue.fields?.epic ? { key: issue.fields.epic.key || '', fields: { name: issue.fields.epic.fields?.name || '', color: issue.fields.epic.fields?.color || '' } } : null),
            parent: issue.fields?.parent ? { key: issue.fields.parent.key || '', fields: { summary: issue.fields.parent.fields?.summary || '' } } : null,
            subtasks: issue.fields?.subtasks || [],
            issuekey: issue.key,
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

    const jql = `worklogAuthor = currentUser() ORDER BY updated DESC`;

    const allIssues: any[] = [];
    let startAt = 0;
    const maxApiResults = 100;
    let totalIssues = 0;
    let hasFetched = false;
    let response: any = null;

    while ((!hasFetched || allIssues.length < totalIssues) && allIssues.length < 2000) {
      response = await axiosInstance.post('/rest/api/2/search', {
        jql,
        fields: ['worklog'],
        startAt,
        maxResults: maxApiResults,
      }, {
        headers: getAuthHeaders(),
      });

      const responseData = response.data as { issues: any[]; total: number };
      totalIssues = responseData.total || 0;
      allIssues.push(...responseData.issues);
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
        const wlStarted = new Date(wl.started);
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
  } catch (error: any) {
    console.error('Hours-by-date API error:', error);
    const status = error.response?.status || error.code || 'UNKNOWN';
    const detail = error.response?.data || error.message || 'Unknown error';
    const message = `Jira API error (${status}): ${JSON.stringify(detail)}`;
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
