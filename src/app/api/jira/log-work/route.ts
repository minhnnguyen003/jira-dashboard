import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import https from 'https';
import { getJiraErrorDetails } from '@/lib/jira/apiError.js';
import { toJiraDateTimeInZone } from '@/lib/dateTime.js';

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
    const { issueKey, timeSpent, started, remainingEstimate, remainingEstimateType, workDescription } = body;

    if (!issueKey) {
      return NextResponse.json({ error: 'Issue key is required' }, { status: 400 });
    }

    if (!timeSpent) {
      return NextResponse.json({ error: 'Time spent is required' }, { status: 400 });
    }

    const axiosInstance = axios.create({
      baseURL: baseUrl,
      httpsAgent,
      timeout: 30000,
    });

    const payload: Record<string, unknown> = {
      timeSpent,
    };

    if (started) {
      const jiraStarted = toJiraDateTimeInZone(started);
      if (!jiraStarted) {
        return NextResponse.json({ error: 'Started date is invalid' }, { status: 400 });
      }
      payload.started = jiraStarted;
    }

    if (workDescription) {
      payload.comment = workDescription;
    }

    if (remainingEstimateType === 'existing') {
      payload.remainingEstimate = remainingEstimate;
    } else if (remainingEstimateType === 'set') {
      payload.remainingEstimate = remainingEstimate;
    } else if (remainingEstimateType === 'reduce') {
      payload.remainingEstimate = `-${remainingEstimate}`;
    }

    const response = await axiosInstance.post(`/rest/api/2/issue/${issueKey}/worklog`, payload, {
      headers: getAuthHeaders(),
    });

    return NextResponse.json(response.data);
  } catch (error: unknown) {
    console.error('Log work API error:', error);
    const { status, detail } = getJiraErrorDetails(error);
    return NextResponse.json(
      { error: `Jira API error (${status}): ${JSON.stringify(detail)}` },
      { status: typeof status === 'number' && status >= 400 ? status : 500 }
    );
  }
}
