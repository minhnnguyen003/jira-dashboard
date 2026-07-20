import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import https from 'https';
import { formatJiraErrorDetail, getJiraErrorDetails } from '@/lib/jira/apiError.js';

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

export async function GET(request: NextRequest) {
  try {
    const baseUrl = (process.env.JIRA_BASE_URL || '').replace(/\/+$/, '');
    if (!baseUrl) {
      throw new Error('JIRA_BASE_URL is not configured');
    }

    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');

    if (!key) {
      return NextResponse.json({ error: 'Issue key is required' }, { status: 400 });
    }

    const axiosInstance = axios.create({
      baseURL: baseUrl,
      httpsAgent,
      timeout: 30000,
    });

    const response = await axiosInstance.get(`/rest/api/2/issue/${key}/editmeta`, {
      headers: getAuthHeaders(),
    });

    return NextResponse.json(response.data);
  } catch (error: unknown) {
    const { status, detail } = getJiraErrorDetails(error);
    const errorMessage = formatJiraErrorDetail(detail);
    console.error('Jira editmeta error:', errorMessage);
    console.error('Full Jira response:', detail);
    return NextResponse.json(
      { error: `Jira API error (${status}): ${errorMessage || 'Unknown error'}` },
      { status: typeof status === 'number' && status >= 400 ? status : 500 }
    );
  }
}
