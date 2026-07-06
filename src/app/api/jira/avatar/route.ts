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
    };
  }

  if (email && apiToken) {
    const credentials = Buffer.from(`${email}:${apiToken}`).toString('base64');
    return {
      Authorization: `Basic ${credentials}`,
    };
  }

  throw new Error('Jira credentials not configured. Set JIRA_BEARER_TOKEN or JIRA_EMAIL+JIRA_API_TOKEN');
}

export async function GET(request: NextRequest) {
  try {
    const src = request.nextUrl.searchParams.get('src') || '';
    const baseUrl = (process.env.JIRA_BASE_URL || '').replace(/\/+$/, '');

    if (!baseUrl) {
      throw new Error('JIRA_BASE_URL is not configured');
    }

    if (!src) {
      return NextResponse.json({ error: 'Missing avatar src' }, { status: 400 });
    }

    const normalizedBase = new URL(baseUrl).origin;
    const normalizedSrc = new URL(src);

    if (normalizedSrc.origin !== normalizedBase) {
      return NextResponse.json({ error: 'Avatar source is not allowed' }, { status: 400 });
    }

    const response = await axios.get<ArrayBuffer>(src, {
      responseType: 'arraybuffer',
      httpsAgent,
      timeout: 30000,
      headers: getAuthHeaders(),
    });

    return new NextResponse(Buffer.from(response.data), {
      status: 200,
      headers: {
        'Content-Type': response.headers['content-type'] || 'image/png',
        'Cache-Control': 'private, max-age=86400',
      },
    });
  } catch (error: any) {
    console.error('Jira avatar proxy error:', error);
    const status = error.response?.status || 500;
    return NextResponse.json(
      { error: 'Failed to load avatar' },
      { status: typeof status === 'number' ? status : 500 },
    );
  }
}
