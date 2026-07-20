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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectKey = searchParams.get('project');
    const query = searchParams.get('query') || '';
    const baseUrl = (process.env.JIRA_BASE_URL || '').replace(/\/+$/, '');

    if (!baseUrl) {
      throw new Error('JIRA_BASE_URL is not configured');
    }

    if (!projectKey) {
      return NextResponse.json([]);
    }

    const axiosInstance = axios.create({
      baseURL: baseUrl,
      httpsAgent,
      timeout: 30000,
    });

    const jql = `project=${projectKey} AND issuetype=Epic ORDER BY updated DESC`;
    const response = await axiosInstance.post('/rest/api/2/search', {
      jql,
      fields: ['key', 'summary'],
      maxResults: 30,
    }, {
      headers: getAuthHeaders(),
    });

    const epics = (response.data.issues as Array<{ key: string; fields: { summary: string } }>).map((e) => ({
      key: e.key,
      summary: e.fields.summary,
    }));

    const filtered = query
      ? epics.filter((e) =>
          e.key.toLowerCase().includes(query.toLowerCase()) ||
          e.summary.toLowerCase().includes(query.toLowerCase())
        )
      : epics;

    return NextResponse.json(filtered);
  } catch (error: unknown) {
    console.error('Jira epics API error:', error);
    const { status, detail } = getJiraErrorDetails(error);
    const message = `Jira API error (${status}): ${JSON.stringify(detail)}`;
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
