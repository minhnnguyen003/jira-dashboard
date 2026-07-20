import { NextResponse } from 'next/server';
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

  throw new Error('Jira credentials not configured');
}

export async function GET() {
  try {
    const baseUrl = (process.env.JIRA_BASE_URL || '').replace(/\/+$/, '');
    if (!baseUrl) {
      throw new Error('JIRA_BASE_URL is not configured');
    }

    const axiosInstance = axios.create({
      baseURL: baseUrl,
      httpsAgent,
      timeout: 30000,
    });

    const response = await axiosInstance.get('/rest/api/2/status', {
      headers: getAuthHeaders(),
    });

    const seen = new Set<string>();
    const statuses = (response.data as Array<{ id?: string; name?: string }>)
      .filter((s) => {
        const name = s.name || '';
        if (!name || seen.has(name)) return false;
        seen.add(name);
        return true;
      })
      .map((s) => ({ id: s.id || '', name: s.name || '' }));

    return NextResponse.json(statuses);
  } catch (error: unknown) {
    console.error('Jira statuses API error:', error);
    const { status, detail } = getJiraErrorDetails(error);
    return NextResponse.json(
      { error: `Jira API error (${status}): ${JSON.stringify(detail)}` },
      { status: 500 }
    );
  }
}
