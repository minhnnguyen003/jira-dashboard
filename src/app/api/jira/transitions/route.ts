import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import https from 'https';
import { getJiraErrorDetails } from '@/lib/jira/apiError.js';
import { sanitizeTransitionFields } from '@/lib/jira/transitionPayload';

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

function formatJiraError(detail: unknown): string {
  if (!detail || typeof detail !== 'object') {
    return typeof detail === 'string' ? detail : 'Unknown error';
  }

  const jiraDetail = detail as {
    errorMessages?: unknown[];
    errors?: Record<string, unknown>;
  };

  const messages: string[] = [];

  if (Array.isArray(jiraDetail.errorMessages)) {
    messages.push(
      ...jiraDetail.errorMessages.filter((message): message is string => typeof message === 'string' && message.trim().length > 0)
    );
  }

  if (jiraDetail.errors && typeof jiraDetail.errors === 'object') {
    messages.push(
      ...Object.values(jiraDetail.errors).filter((message): message is string => typeof message === 'string' && message.trim().length > 0)
    );
  }

  return messages.length > 0 ? messages.join(' | ') : JSON.stringify(detail);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');

    if (!key) {
      return NextResponse.json({ error: 'Issue key is required' }, { status: 400 });
    }

    const baseUrl = (process.env.JIRA_BASE_URL || '').replace(/\/+$/, '');
    if (!baseUrl) {
      throw new Error('JIRA_BASE_URL is not configured');
    }

    const axiosInstance = axios.create({
      baseURL: baseUrl,
      httpsAgent,
      timeout: 30000,
    });

    const response = await axiosInstance.get(`/rest/api/2/issue/${key}/transitions?expand=transitions.fields`, {
      headers: getAuthHeaders(),
    });

    return NextResponse.json(response.data);
  } catch (error: unknown) {
    console.error('Transitions API error:', error);
    const { status, detail } = getJiraErrorDetails(error);
    return NextResponse.json(
      { error: `Jira API error (${status}): ${formatJiraError(detail)}` },
      { status: typeof status === 'number' && status >= 400 ? status : 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const baseUrl = (process.env.JIRA_BASE_URL || '').replace(/\/+$/, '');
    if (!baseUrl) {
      throw new Error('JIRA_BASE_URL is not configured');
    }

    const body = await request.json();
    const { key, transitionId, fields } = body;

    if (!key || !transitionId) {
      return NextResponse.json({ error: 'Issue key and transitionId are required' }, { status: 400 });
    }

    const axiosInstance = axios.create({
      baseURL: baseUrl,
      httpsAgent,
      timeout: 30000,
    });

    const transitionPayload: Record<string, unknown> = {
      transition: { id: transitionId },
    };

    const cleanedFields = sanitizeTransitionFields(fields);
    if (cleanedFields) {
      transitionPayload.fields = cleanedFields;
    }

    await axiosInstance.post(`/rest/api/2/issue/${key}/transitions`, transitionPayload, {
      headers: getAuthHeaders(),
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Transition API error:', error);
    const { status, detail } = getJiraErrorDetails(error);
    return NextResponse.json(
      { error: `Jira API error (${status}): ${formatJiraError(detail)}` },
      { status: typeof status === 'number' && status >= 400 ? status : 500 }
    );
  }
}
