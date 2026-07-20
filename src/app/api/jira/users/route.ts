import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import https from 'https';
import { getJiraErrorDetails } from '@/lib/jira/apiError.js';
import { fetchAllJiraUsers, normalizeJiraUsers } from './userPagination.js';
import {
  createCachedUsersDirectory,
  createUsersRateLimiter,
  getUsersRequestClientKey,
  isSameOriginUsersRequest,
  USERS_DIRECTORY_CACHE_TTL_MS,
  USERS_DIRECTORY_DEADLINE_MS,
  USERS_DIRECTORY_MAX_PAGES,
  USERS_DIRECTORY_PAGE_SIZE,
  USERS_DIRECTORY_RATE_LIMIT,
  USERS_DIRECTORY_RATE_LIMIT_WINDOW_MS,
} from './usersRequestGuards.js';

const httpsAgent = new https.Agent({
  rejectUnauthorized: (process.env.JIRA_SKIP_TLS === 'true') ? false : true,
});

const usersDirectoryCache = createCachedUsersDirectory({ ttlMs: USERS_DIRECTORY_CACHE_TTL_MS });
const usersRateLimiter = createUsersRateLimiter({
  limit: USERS_DIRECTORY_RATE_LIMIT,
  windowMs: USERS_DIRECTORY_RATE_LIMIT_WINDOW_MS,
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
      if (!isSameOriginUsersRequest(request)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      if (!usersRateLimiter.isAllowed(getUsersRequestClientKey(request))) {
        return NextResponse.json({ error: 'Too many users directory requests' }, { status: 429 });
      }

      const users = await usersDirectoryCache.get(async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), USERS_DIRECTORY_DEADLINE_MS);

        try {
          return await fetchAllJiraUsers(async (
            { startAt, maxResults, signal }: { startAt: number; maxResults: number; signal?: AbortSignal },
          ) => {
            const response = await axiosInstance.get('/rest/api/2/user/search', {
              params: {
                username: '',
                search: '',
                startAt: String(startAt),
                maxResults: String(maxResults),
              },
              headers: getAuthHeaders(),
              signal,
            });
            return response.data;
          }, USERS_DIRECTORY_PAGE_SIZE, USERS_DIRECTORY_MAX_PAGES, { signal: controller.signal });
        } finally {
          clearTimeout(timeout);
        }
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
