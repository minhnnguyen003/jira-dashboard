'use client';

import { useState, useCallback } from 'react';
import JiraBarChart from '@/components/chart/JiraBarChart';
import JiraTable from '@/components/table/JiraTable';
import TaskDetailModal from '@/components/modal/TaskDetailModal';
import { JiraGroupedData, DashboardIssue, JiraIssue } from '@/types/jira';
import { useLanguage } from '@/lib/i18n';

interface DashboardData {
  issues: DashboardIssue[];
  fullIssues: Record<string, JiraIssue>;
  aggregated: JiraGroupedData[];
  total: number;
}

export default function DashboardPage() {
  const { t } = useLanguage();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jql, setJql] = useState('project = YOUR_PROJECT ORDER BY updated DESC');
  const [groupBy, setGroupBy] = useState('assignee');
  const [startAt, setStartAt] = useState(0);
  const [maxResults] = useState(100);
  const [hasSearched, setHasSearched] = useState(false);

  const fetchData = useCallback(async (newJql: string, newGroupBy: string, newStartAt: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/jira/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jql: newJql, groupBy: newGroupBy, startAt: newStartAt, maxResults, assigneeEmails: [] }),
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [maxResults]);

  const handleSearch = useCallback(() => {
    setHasSearched(true);
    fetchData(jql, groupBy, 0);
  }, [jql, groupBy, fetchData]);

  const handleGroupChange = (newGroup: string) => {
    setGroupBy(newGroup);
    setHasSearched(true);
    fetchData(jql, newGroup, 0);
  };

  const handlePageChange = (page: number) => {
    const offset = (page - 1) * maxResults;
    fetchData(jql, groupBy, offset);
  };

  const timeEst = data?.aggregated.reduce((s, i) => s + i.estimatedSeconds, 0) || 0;
  const timeLogged = data?.aggregated.reduce((s, i) => s + i.loggedSeconds, 0) || 0;
  const [selectedIssue, setSelectedIssue] = useState<JiraIssue | null>(null);

  const handleTaskClick = useCallback((issue: JiraIssue) => {
    setSelectedIssue(issue);
  }, []);

  const handleCloseDialog = useCallback(() => {
    setSelectedIssue(null);
  }, []);

  const handleRefreshTask = useCallback(async (issue: JiraIssue) => {
    const refreshPromise = hasSearched
      ? fetchData(jql, groupBy, startAt)
      : Promise.resolve();
    const refreshedIssueResPromise = fetch(`/api/jira/issue?key=${encodeURIComponent(issue.key)}`);

    const [, refreshedIssueRes] = await Promise.all([
      refreshPromise,
      refreshedIssueResPromise,
    ]);

    if (!refreshedIssueRes.ok) {
      throw new Error(`Issue refresh failed: ${refreshedIssueRes.status}`);
    }

    const refreshedIssue: JiraIssue = await refreshedIssueRes.json();
    setSelectedIssue(refreshedIssue);
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        fullIssues: {
          ...prev.fullIssues,
          [refreshedIssue.key]: refreshedIssue,
        },
      };
    });
    return refreshedIssue;
  }, [fetchData, groupBy, hasSearched, jql, startAt]);

  return (
    <div className="flex flex-col flex-1 p-6">
      <div className="mb-6 animate-slide-up">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{t('jql.title')}</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-dim)' }}>{t('jql.subtitle')}</p>
      </div>

      <div className="mb-6 flex flex-wrap gap-4 items-end animate-slide-up" style={{ animationDelay: '0.08s' }}>
        <div className="flex-1 min-w-[300px]">
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-dim)' }}>{t('jql.queryLabel')}</label>
          <input
            type="text"
            value={jql}
            onChange={(e) => setJql(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder={t('jql.queryPlaceholder')}
            className="input-field w-full px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-dim)' }}>{t('jql.groupByLabel')}</label>
          <select value={groupBy} onChange={(e) => handleGroupChange(e.target.value)} className="input-field px-3 py-2 text-sm">
            <option value="assignee">{t('jql.groupBy.assignee')}</option>
            <option value="sprint">{t('jql.groupBy.sprint')}</option>
            <option value="status">{t('jql.groupBy.status')}</option>
            <option value="epic">{t('jql.groupBy.epic')}</option>
          </select>
        </div>
        <button onClick={handleSearch} disabled={loading} className="btn-primary px-5 py-2 text-sm">
          {loading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              {t('jql.searching')}
            </span>
          ) : t('jql.search')}
        </button>
      </div>

      {loading && <div className="flex items-center justify-center py-16 animate-pulse" style={{ color: 'var(--text-muted)' }}>{t('jql.loading')}</div>}

      {error && (
        <div className="mb-6 rounded-xl p-4" style={{ background: 'var(--danger-bg)' }}>
          <div className="text-sm" style={{ color: 'var(--danger)' }}>{error}</div>
        </div>
      )}

      {!loading && !error && data && (
        <div className="animate-slide-up" style={{ animationDelay: '0.15s' }}>
          <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="metric-card p-4">
              <div className="text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{t('jql.totalIssues')}</div>
              <div className="text-2xl font-bold mt-1" style={{ color: 'var(--text)' }}>{data.total}</div>
            </div>
            <div className="metric-card p-4">
              <div className="text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{t('jql.totalEstimated')}</div>
              <div className="text-2xl font-bold mt-1" style={{ color: 'var(--accent)' }}>{Math.round(timeEst / 3600)}h</div>
            </div>
            <div className="metric-card p-4">
              <div className="text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{t('jql.totalLogged')}</div>
              <div className="text-2xl font-bold mt-1" style={{ color: 'var(--success)' }}>{Math.round(timeLogged / 3600)}h</div>
            </div>
          </div>
          <div className="mb-6"><JiraBarChart data={data.aggregated} groupBy={groupBy} /></div>
          <JiraTable data={data.issues} onPageChange={handlePageChange} onTaskClick={handleTaskClick} fullIssues={data.fullIssues} />
        </div>
      )}

      <TaskDetailModal issue={selectedIssue} onClose={handleCloseDialog} onRefresh={handleRefreshTask} />

      {!loading && !error && !hasSearched && (
        <div className="flex items-center justify-center py-20 animate-slide-up">
          <div className="text-center empty-state p-8 max-w-md">
            <svg className="w-10 h-10 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--text-muted)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-dim)' }}>{t('jql.emptyTitle')}</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('jql.emptySubtitle')}</p>
          </div>
        </div>
      )}
    </div>
  );
}
