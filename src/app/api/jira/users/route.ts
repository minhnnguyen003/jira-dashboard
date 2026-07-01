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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query') || '';
    const baseUrl = (process.env.JIRA_BASE_URL || '').replace(/\/+$/, '');

    if (!baseUrl) {
      throw new Error('JIRA_BASE_URL is not configured');
    }

    const axiosInstance = axios.create({
      baseURL: baseUrl,
      httpsAgent,
      timeout: 30000,
    });

    const params: Record<string, string> = {
      username: query,
      maxResults: '20',
    };

    if (query) {
      params.search = query;
    }

    const response = await axiosInstance.get('/rest/api/2/user/search', {
      params,
      headers: getAuthHeaders(),
    });

    const users = (
      response.data as Array<{
        name?: string;
        displayName?: string;
        emailAddress?: string;
        avatarUrls?: Record<string, string>;
      }>
    ).map((u) => ({
      name: u.name || '',
      displayName: u.displayName || u.name || '',
      email: u.emailAddress || u.name || '',
      avatarUrl: u.avatarUrls?.['48x48'] || '',
    }));

    return NextResponse.json(users);
  } catch (error: any) {
    console.error('Jira users API error:', error);
    const status = error.response?.status || error.code || 'UNKNOWN';
    const detail = error.response?.data || error.message || 'Unknown error';
    const message = `Jira API error (${status}): ${JSON.stringify(detail)}`;
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
