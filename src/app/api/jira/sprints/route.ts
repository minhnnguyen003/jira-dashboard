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

    // Use Jira Agile API to get active sprints
    const sprintsResponse = await axiosInstance.get('/rest/agile/1.0/board', {
      params: { projectKeyOrId: projectKey },
      headers: getAuthHeaders(),
    });

    if (!sprintsResponse.data.values || sprintsResponse.data.values.length === 0) {
      return NextResponse.json([]);
    }

    const boardId = sprintsResponse.data.values[0].id;
    const boardsResponse = await axiosInstance.get(`/rest/agile/1.0/board/${boardId}/sprint`, {
      params: { state: 'active,future' },
      headers: getAuthHeaders(),
    });

    let sprints = ((boardsResponse.data.values || []) as Array<{ id: string; name: string; state: string }>).map((s) => ({
      id: s.id,
      name: s.name,
      state: s.state,
    }));

    // Filter by query
    if (query) {
      sprints = sprints.filter((s) =>
        s.name.toLowerCase().includes(query.toLowerCase())
      );
    }

    // Sort: active first, then future
    sprints.sort((a, b) => {
      if (a.state === 'active' && b.state !== 'active') return -1;
      if (a.state !== 'active' && b.state === 'active') return 1;
      return 0;
    });

    return NextResponse.json(sprints);
  } catch (error: unknown) {
    console.error('Jira sprints API error:', error);
    // If agile API fails (Jira Cloud), return empty
    const { status } = getJiraErrorDetails(error);
    if (status === 404 || status === 401) {
      return NextResponse.json([]);
    }
    const message = `Jira API error (${status})`;
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
