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


interface JiraCreateErrorDetail {
  errors?: Record<string, string>;
}

function getRejectedFields(detail: unknown): string[] {
  if (!detail || typeof detail !== 'object' || !('errors' in detail)) {
    return [];
  }

  const errors = (detail as JiraCreateErrorDetail).errors;
  if (!errors) return [];

  return Object.entries(errors)
    .filter(([, message]) => message.includes('cannot be set'))
    .map(([field]) => field);
}
function formatJiraDateTime(value: unknown): string | null {
  if (!value) return null;

  const raw = String(value).trim();
  if (!raw) return null;

  const normalized = raw.length === 10 ? `${raw}T00:00` : raw;
  const [date, time = '00:00'] = normalized.split('T');
  const [hour = '00', minute = '00', second = '00'] = time.split(':');

  return `${date}T${hour.padStart(2, '0')}:${minute.padStart(2, '0')}:${second.padStart(2, '0')}.000+0700`;
}


export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const baseUrl = (process.env.JIRA_BASE_URL || '').replace(/\/+$/, '');

    if (!baseUrl) {
      throw new Error('JIRA_BASE_URL is not configured');
    }

    const axiosInstance = axios.create({
      baseURL: baseUrl,
      httpsAgent,
      timeout: 30000,
    });

    const fields: Record<string, unknown> = {
      project: { key: body.project },
      summary: body.summary,
      issuetype: { name: body.issuetype || 'Task' },
    };
    const payload = { fields };

    if (body.description) {
      fields.description = body.description;
    }
    if (body.priority) {
      fields.priority = { name: body.priority };
    }
    if (body.assignee) {
      fields.assignee = { name: body.assignee };
    }
    if (body.parent) {
      fields.parent = { key: body.parent };
    }
    if (body.labels && Array.isArray(body.labels)) {
      fields.labels = body.labels;
    }
    if (body.components && Array.isArray(body.components) && body.components.length > 0) {
      fields.components = body.components.map((c: string) => ({ name: c }));
    }
    if (body.customFieldSprint) {
      fields.customfield_10016 = parseInt(body.customFieldSprint);
    }
    if (body.customFieldEpic) {
      fields.customfield_10015 = { key: body.customFieldEpic };
    }
    if (body.customFieldStoryPoints) {
      fields.customfield_10014 = parseInt(body.customFieldStoryPoints);
    }
    const startDateTime = formatJiraDateTime(body.startDate);
    if (startDateTime) {
      fields.customfield_10300 = startDateTime;
    }
    const dueDateTime = formatJiraDateTime(body.dueDate);
    if (dueDateTime) {
      fields.customfield_10302 = dueDateTime;
    }
    if (body.originalEstimate || body.remainingEstimate) {
      const timetracking: Record<string, string> = {};
      if (body.originalEstimate) {
        timetracking.originalEstimate = String(body.originalEstimate);
      }
      if (body.remainingEstimate) {
        timetracking.remainingEstimate = String(body.remainingEstimate);
      }
      fields.timetracking = timetracking;
    }

    const headers = getAuthHeaders();
    let response;

    try {
      response = await axiosInstance.post('/rest/api/2/issue', payload, { headers });
    } catch (error: unknown) {
      if (!axios.isAxiosError(error) || error.response?.status !== 400) {
        throw error;
      }

      const rejectedFields = getRejectedFields(error.response.data);
      if (rejectedFields.length === 0) {
        throw error;
      }

      rejectedFields.forEach((field) => delete fields[field]);
      response = await axiosInstance.post('/rest/api/2/issue', payload, { headers });
    }

    return NextResponse.json({
      key: response.data.key,
      id: response.data.id,
      self: response.data.self,
    });
  } catch (error: unknown) {
    console.error('Jira create API error:', error);

    let status = 500;
    let detail: unknown = error instanceof Error ? error.message : 'Unknown error';

    if (axios.isAxiosError(error)) {
      status = error.response?.status || 500;
      detail = error.response?.data || error.message;
    }

    const message = `Jira API error (${status}): ${JSON.stringify(detail)}`;
    return NextResponse.json(
      { error: message, detail },
      { status }
    );
  }
}









