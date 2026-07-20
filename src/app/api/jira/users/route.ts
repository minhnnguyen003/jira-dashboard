import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import https from 'https';
import { getJiraErrorDetails } from '@/lib/jira/apiError.js';
import { fetchAllJiraUsers, normalizeJiraUsers } from './userPagination.js';

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
    const all = searchParams.get('all') === 'true';
    const baseUrl = (process.env.JIRA_BASE_URL || '').replace(/\/+$/, '');

    if (!baseUrl) {
      throw new Error('JIRA_BASE_URL is not configured');
    }

    const axiosInstance = axios.create({
      baseURL: baseUrl,
      httpsAgent,
      timeout: 30000,
    });

    if (all) {
      const users = await fetchAllJiraUsers(async ({ startAt, maxResults }: { startAt: number; maxResults: number }) => {
        const response = await axiosInstance.get('/rest/api/2/user/search', {
          params: {
            username: '',
            search: '',
            startAt: String(startAt),
            maxResults: String(maxResults),
          },
          headers: getAuthHeaders(),
        });
        return response.data;
      });

      return NextResponse.json(users);
    }

    const response = await axiosInstance.get('/rest/api/2/user/search', {
      params: { username: query, ...(query ? { search: query } : {}), maxResults: '20' },
      headers: getAuthHeaders(),
    });

    return NextResponse.json(normalizeJiraUsers(response.data));
  } catch (error: unknown) {
    console.error('Jira users API error:', error);
    const { status, detail } = getJiraErrorDetails(error);
    const message = `Jira API error (${status}): ${JSON.stringify(detail)}`;
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
