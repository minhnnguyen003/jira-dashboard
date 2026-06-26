'use client';

import { useState, useCallback, useMemo } from 'react';
import JiraBarChart from '@/components/chart/JiraBarChart';
import JiraTable from '@/components/table/JiraTable';
import TaskDetailModal from '@/components/modal/TaskDetailModal';
import AssigneeMultiSelect from '@/components/form/AssigneeMultiSelect';
import { JiraGroupedData, DashboardIssue, JiraIssue } from '@/types/jira';
import { useLanguage } from '@/lib/i18n';

interface AssigneeChip {
  email: string;
  displayName: string;
}

interface DashboardData {
  issues: DashboardIssue[];
  fullIssues: Record<string, JiraIssue>;
  aggregated: JiraGroupedData[];
  total: number;
}

interface StoredQuery {
  id: string;
  name: string;
  jql: string;
  description: string;
}

const storedQueriesRaw = [
  { id: '10245', nameKey: 'statistics.report.completedThisMonth' as const, jql: '', descKey: 'statistics.report.completedDesc' as const },
  { id: 'sprint-progress', nameKey: 'statistics.report.sprintProgress' as const, jql: 'sprint in openSprints() ORDER BY rank', descKey: 'statistics.report.sprintDesc' as const },
  { id: 'overdue', nameKey: 'statistics.report.overdue' as const, jql: 'status != Done AND status != Closed AND dueDate < now() ORDER BY dueDate ASC', descKey: 'statistics.report.overdueDesc' as const },
  { id: 'no-estimate', nameKey: 'statistics.report.noEstimate' as const, jql: 'originalEstimate IS EMPTY AND status != Done ORDER BY updated DESC', descKey: 'statistics.report.noEstimateDesc' as const },
];

export default function StatisticsPage() {
  const { t } = useLanguage();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedQuery, setSelectedQuery] = useState<string>('');
  const [groupBy, setGroupBy] = useState('assignee');
  const [maxResults] = useState(100);
  const [hasSearched, setHasSearched] = useState(false);
  const [assignees, setAssignees] = useState<AssigneeChip[]>([]);

  const storedQueries = useMemo(() => storedQueriesRaw.map((q) => ({ id: q.id, name: t(q.nameKey), jql: q.jql, description: t(q.descKey) })), [t]);

  const fetchData = useCallback(async (queryId: string, jql: string, newGroupBy: string, newAssignees: AssigneeChip[]) => {
    setLoading(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        queryId,
        groupBy: newGroupBy,
        startAt: 0,
        maxResults,
        assigneeEmails: newAssignees.map((a) => a.email),
      };
      if (queryId !== '10245') {
        body.jql = jql;
      }
      const res = await fetch('/api/jira/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [maxResults]);

  const handleExecute = useCallback(() => {
    const q = storedQueries.find((x) => x.id === selectedQuery);
    if (!q) return;
    setHasSearched(true);
    fetchData(q.id, q.jql, groupBy, assignees);
  }, [selectedQuery, groupBy, assignees, fetchData]);

  const handlePageChange = () => {
    // JiraTable paginates the loaded issues client-side on this page.
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

  return (
    <div className="flex flex-col flex-1 p-6">
      <div className="mb-6 animate-slide-up">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{t('statistics.title')}</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-dim)' }}>{t('statistics.subtitle')}</p>
      </div>

      <div className="mb-6 animate-slide-up" style={{ animationDelay: '0.08s' }}>
        <label className="block text-sm font-medium" style={{ color: 'var(--text-dim)' }}>{t('statistics.reportLabel')}</label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
          {storedQueries.map((q) => (
            <div
              key={q.id}
              className={`query-card p-4 ${selectedQuery === q.id ? 'active' : ''}`}
              onClick={() => setSelectedQuery(q.id)}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{q.name}</h3>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{q.description}</p>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ml-2 ${
                  selectedQuery === q.id
                    ? 'border-[var(--accent)] bg-[var(--accent)]'
                    : 'border-[var(--border-hover)]'
                }`}>
                  {selectedQuery === q.id && (
                    <svg className="w-3 h-3" fill="var(--bg)" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-6 animate-slide-up" style={{ animationDelay: '0.16s' }}>
        <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-dim)' }}>{t('statistics.assigneeFilterLabel')}</label>
        <AssigneeMultiSelect value={assignees} onChange={setAssignees} />
        <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>{t('statistics.assigneeFilterHint')}</p>
      </div>

      <div className="mb-6 flex flex-wrap gap-4 items-end animate-slide-up" style={{ animationDelay: '0.2s' }}>
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-dim)' }}>{t('jql.groupByLabel')}</label>
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value)}
            className="input-field px-3 py-2 text-sm"
          >
            <option value="assignee">{t('jql.groupBy.assignee')}</option>
            <option value="sprint">{t('jql.groupBy.sprint')}</option>
            <option value="status">{t('jql.groupBy.status')}</option>
            <option value="epic">{t('jql.groupBy.epic')}</option>
          </select>
        </div>
        <button onClick={handleExecute} disabled={loading || !selectedQuery} className="btn-primary px-5 py-2 text-sm">
          {loading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              {t('statistics.executing')}
            </span>
          ) : t('statistics.execute')}
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="animate-pulse" style={{ color: 'var(--text-muted)' }}>{t('jql.loading')}</div>
        </div>
      )}

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
          <div className="mb-6 animate-slide-up" style={{ animationDelay: '0.25s' }}>
            <JiraBarChart key={`chart-${data.total}-${groupBy}-${data.aggregated.map(a => a.label).join('|')}`} data={data.aggregated} groupBy={groupBy} />
          </div>
          <JiraTable data={data.issues} onPageChange={handlePageChange} onTaskClick={handleTaskClick} fullIssues={data.fullIssues} />
        </div>
      )}

      {!loading && !error && !hasSearched && (
        <div className="flex items-center justify-center py-20 animate-slide-up">
          <div className="text-center empty-state p-8 max-w-md">
            <svg className="w-10 h-10 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--text-muted)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-dim)' }}>{t('statistics.emptyTitle')}</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('statistics.emptySubtitle')}</p>
          </div>
        </div>
      )}

      <TaskDetailModal issue={selectedIssue} onClose={handleCloseDialog} />
    </div>
  );
}


