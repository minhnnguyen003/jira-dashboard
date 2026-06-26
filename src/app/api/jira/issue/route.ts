import { NextRequest, NextResponse } from 'next/server';
import { getJiraIssueByKey } from '@/lib/jira/api';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');

    if (!key) {
      return NextResponse.json({ error: 'Issue key is required' }, { status: 400 });
    }

    const issue = await getJiraIssueByKey(key);
    return NextResponse.json(issue);
  } catch (error) {
    console.error('Issue API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
