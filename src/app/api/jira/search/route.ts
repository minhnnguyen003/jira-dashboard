import { NextRequest, NextResponse } from 'next/server';
import { searchJiraByJQL, mapIssuesToDashboard, aggregateByAssignee, aggregateBySprint, aggregateByStatus, aggregateByStatusWithOptions, aggregateByEpic, getSavedQueryJQL } from '@/lib/jira/api';
import { JiraGroupedData, JiraIssue } from '@/types/jira';
import { buildPersonalJql } from '@/lib/jira/personalJql.js';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const startAt = parseInt(body.startAt || '0');
    const maxResults = parseInt(body.maxResults || '50');
    const groupBy = body.groupBy || 'assignee';
    const assigneeEmails: string[] = body.assigneeEmails || [];
    const queryId = body.queryId;
    const statusGrouping = body.statusGrouping;

    const personalMode = body.personalMode === true;
    const assigneeEmail: string = body.assigneeEmail || '';
    const year = parseInt(body.year || String(new Date().getFullYear()));
    const month = parseInt(body.month || String(new Date().getMonth() + 1));

    let jql: string;
    if (personalMode && assigneeEmail) {
      jql = buildPersonalJql(assigneeEmail, year, month);
    } else if (typeof queryId === 'string' && /^\d+$/.test(queryId)) {
      jql = await getSavedQueryJQL(queryId);
    } else {
      jql = body.jql || 'project = YOUR_PROJECT ORDER BY updated DESC';
    }

    if (assigneeEmails.length > 0) {
      const assigneeFilter = ` AND assignee in (${assigneeEmails.map(e => `"${e}"`).join(', ')})`;
      const orderByIndex = jql.toUpperCase().lastIndexOf(' ORDER BY');
      if (orderByIndex !== -1) {
        jql = jql.slice(0, orderByIndex) + assigneeFilter + jql.slice(orderByIndex);
      } else {
        jql = jql + assigneeFilter;
      }
    }

    const { issues } = await searchJiraByJQL(jql, startAt, maxResults);
    const dashboardIssues = mapIssuesToDashboard(issues);

    const fullIssuesMap: Record<string, JiraIssue> = {};
    issues.forEach((issue: JiraIssue) => {
      fullIssuesMap[issue.key] = issue;
    });

    let aggregated: JiraGroupedData[] = [];
    switch (groupBy) {
      case 'assignee':
        aggregated = aggregateByAssignee(issues);
        break;
      case 'sprint':
        aggregated = aggregateBySprint(issues);
        break;
      case 'status':
        aggregated = statusGrouping === 'personal'
          ? aggregateByStatusWithOptions(issues, { mergeDoneResolved: true })
          : aggregateByStatus(issues);
        break;
      case 'epic':
        aggregated = aggregateByEpic(issues);
        break;
      default:
        aggregated = aggregateByAssignee(issues);
    }

    return NextResponse.json({
      issues: dashboardIssues,
      fullIssues: fullIssuesMap,
      aggregated,
      total: issues.length,
    });
  } catch (error) {
    console.error('Jira API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
