import { NextRequest, NextResponse } from 'next/server';
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

export async function POST(request: NextRequest) {
  try {
    const baseUrl = (process.env.JIRA_BASE_URL || '').replace(/\/+$/, '');
    if (!baseUrl) {
      throw new Error('JIRA_BASE_URL is not configured');
    }

    const body = await request.json();
    const { key, fields } = body;

    if (!key) {
      return NextResponse.json({ error: 'Issue key is required' }, { status: 400 });
    }

    const axiosInstance = axios.create({
      baseURL: baseUrl,
      httpsAgent,
      timeout: 30000,
    });

    console.log('[Update Issue] Request body:', JSON.stringify({ key, fields }, null, 2));

    const response = await axiosInstance.put(`/rest/api/2/issue/${key}`, { fields }, {
      headers: getAuthHeaders(),
    });

    console.log('[Update Issue] Jira response status:', response.status);
    console.log('[Update Issue] Jira response body (full):', JSON.stringify(response.data));
    console.log('[Update Issue] Fields sent to Jira:', JSON.stringify(fields));

    return NextResponse.json(response.data);
  } catch (error: unknown) {
    const { status, detail } = getJiraErrorDetails(error);
    const jiraDetail = detail as {
      errors?: Record<string, unknown>;
      errorMessages?: unknown[];
      message?: string;
    };
    let errorMessage = '';
    if (jiraDetail?.errors && typeof jiraDetail.errors === 'object') {
      errorMessage = Object.entries(jiraDetail.errors)
        .map(([field, msg]) => `${field}: ${msg}`)
        .join(' | ');
    }
    if (!errorMessage) {
      errorMessage = jiraDetail?.errorMessages?.join(', ') || jiraDetail?.message || JSON.stringify(detail);
    }
    console.error('Jira update error:', errorMessage);
    console.error('Full Jira response:', JSON.stringify(detail));
    return NextResponse.json(
      { error: `Jira API error (${status}): ${errorMessage || 'Unknown error'}` },
      { status: typeof status === 'number' && status >= 400 ? status : 500 }
    );
  }
}
