'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import JiraBarChart from '@/components/chart/JiraBarChart';
import JiraTable from '@/components/table/JiraTable';
import TaskDetailModal from '@/components/modal/TaskDetailModal';
import { DashboardIssue, JiraGroupedData, JiraIssue } from '@/types/jira';
import { useLanguage } from '@/lib/i18n';

interface DashboardData {
  issues: DashboardIssue[];
  fullIssues: Record<string, JiraIssue>;
  aggregated: JiraGroupedData[];
  total: number;
}

interface WorkingDayData {
  year: number;
  month: number;
  holidayDates: string[];
  workingDays: number;
  source: 'nager' | 'fallback';
}

const PERSONAL_QUERY_ID = '10244';
const GROUP_ORDER = ['Open', 'In Progress', 'Pending', 'Done / Resolved'];
const DONE_RESOLVED_STATUSES = new Set(['Done', 'Resolved', 'Closed']);

function formatHours(seconds: number) {
  return `${Math.round(seconds / 3600)}h`;
}

function formatEffort(value: number) {
  return value.toFixed(2);
}

function sortGroupedStatus(data: JiraGroupedData[]) {
  return [...data].sort((a, b) => {
    const aIndex = GROUP_ORDER.indexOf(a.label);
    const bIndex = GROUP_ORDER.indexOf(b.label);
    const normalizedA = aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex;
    const normalizedB = bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex;

    if (normalizedA !== normalizedB) {
      return normalizedA - normalizedB;
    }

    return a.label.localeCompare(b.label);
  });
}

export default function PersonalStatisticsPage() {
  const { t } = useLanguage();
  const [data, setData] = useState<DashboardData | null>(null);
  const [workingDayData, setWorkingDayData] = useState<WorkingDayData | null>(null);
  const [loading, setLoading] = useState(false);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [maxResults] = useState(100);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const fetchWorkingDays = useCallback(async () => {
    setCalendarLoading(true);
    try {
      const now = new Date();
      const params = new URLSearchParams({
        year: String(now.getFullYear()),
        month: String(now.getMonth() + 1),
      });
      const res = await fetch(`/api/calendar/vn-working-days?${params.toString()}`);
      if (!res.ok) throw new Error(`Calendar API error: ${res.status}`);
      setWorkingDayData(await res.json());
    } catch {
      setWorkingDayData(null);
    } finally {
      setCalendarLoading(false);
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/jira/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          queryId: PERSONAL_QUERY_ID,
          groupBy: 'status',
          statusGrouping: 'personal',
          startAt: 0,
          maxResults,
        }),
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);

      const payload = (await res.json()) as DashboardData;
      setData({
        ...payload,
        aggregated: sortGroupedStatus(payload.aggregated),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [maxResults]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchWorkingDays();
      void fetchData();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [fetchData, fetchWorkingDays]);

  const [selectedIssue, setSelectedIssue] = useState<JiraIssue | null>(null);
  const handleTaskClick = useCallback((issue: JiraIssue) => {
    setSelectedIssue(issue);
  }, []);
  const handleCloseDialog = useCallback(() => {
    setSelectedIssue(null);
  }, []);

  const handlePageChange = useCallback(() => {
    // JiraTable paginates the loaded issues client-side on this page.
  }, []);

  const timeEst = data?.aggregated.reduce((sum, item) => sum + item.estimatedSeconds, 0) || 0;
  const timeLogged = data?.aggregated.reduce((sum, item) => sum + item.loggedSeconds, 0) || 0;

  const effort = useMemo(() => {
    if (!workingDayData || workingDayData.workingDays <= 0) return null;
    const loggedHours = timeLogged / 3600;
    if (loggedHours <= 0) return null;
    return (workingDayData.workingDays * 7) / loggedHours;
  }, [timeLogged, workingDayData]);

  const filteredIssues = useMemo(() => {
    if (!data || !statusFilter) return data?.issues || [];

    return data.issues.filter((issue) => {
      if (statusFilter === 'Done / Resolved') {
        return DONE_RESOLVED_STATUSES.has(issue.status);
      }

      return issue.status === statusFilter;
    });
  }, [data, statusFilter]);

  const handleChartFilter = useCallback((label: string) => {
    setStatusFilter((current) => current === label ? null : label);
  }, []);

  const effortStyle = useMemo(() => {
    const isLight = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light';
    if (effort === null) {
      return { color: 'var(--text)' };
    }

    if (effort > 1) {
      return { color: isLight ? '#d14343' : '#ff8f8f' };
    }

    return { color: isLight ? '#1f8f5f' : '#72d7a0' };
  }, [effort]);

  return (
    <div className="flex flex-col flex-1 p-6">
      <div className="mb-6 animate-slide-up">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{t('personal.title')}</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-dim)' }}>
          {t('personal.subtitle')}
        </p>
      </div>

      <div className="mb-6 animate-slide-up" style={{ animationDelay: '0.08s' }}>
        <div className="flex flex-wrap items-center gap-3 mt-2">
          <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
            {t('personal.savedFilterInfo')}
          </p>
          {workingDayData && (
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              {t('personal.workingDays', { days: String(workingDayData.workingDays) })}
              {workingDayData.source === 'fallback' ? t('personal.workingDays.fallback') : t('personal.workingDays.included')}
            </p>
          )}
          {!workingDayData && !calendarLoading && (
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              {t('personal.calendarLoading')}
            </p>
          )}
        </div>
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
          <div className="mb-6 grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
            <div className="xl:col-span-6 h-full">
              <JiraBarChart data={data.aggregated} groupBy="status" activeLabel={statusFilter} onBarClick={handleChartFilter} />
            </div>
            <div className="xl:col-span-6 grid grid-cols-1 gap-3">
              <div className="metric-card p-4">
                <div className="text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{t('jql.totalIssues')}</div>
                <div className="text-2xl font-bold mt-1" style={{ color: 'var(--text)' }}>{data.total}</div>
              </div>
              <div className="metric-card p-4">
                <div className="text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{t('jql.totalEstimated')}</div>
                <div className="text-2xl font-bold mt-1" style={{ color: 'var(--accent)' }}>{formatHours(timeEst)}</div>
              </div>
              <div className="metric-card p-4">
                <div className="text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{t('jql.totalLogged')}</div>
                <div className="text-2xl font-bold mt-1" style={{ color: 'var(--success)' }}>{formatHours(timeLogged)}</div>
              </div>
              <div className="metric-card p-4">
                <div className="text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{t('personal.estimatedHoursLabel')}</div>
                <div className="text-2xl font-bold mt-1" style={{ color: 'var(--text)' }}>
                  {workingDayData ? workingDayData.workingDays * 7 : '-'}h
                </div>
                <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                  {t('personal.estimatedHoursHint')}
                </p>
              </div>
              <div className="metric-card p-4">
                <div className="text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{t('personal.effortLabel')}</div>
                <div className="text-2xl font-bold mt-1" style={effortStyle}>
                  {effort === null ? '-' : formatEffort(effort)}
                </div>
                <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                  {t('personal.effortHint')}
                </p>
              </div>
            </div>
          </div>

          {statusFilter && (
            <div className="mb-3 flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
              <span>{t('personal.filterStatus')}</span>
              <button
                type="button"
                className="col-btn active-col"
                onClick={() => setStatusFilter(null)}
              >
                {statusFilter} x
              </button>
            </div>
          )}

          <JiraTable data={filteredIssues} onPageChange={handlePageChange} onTaskClick={handleTaskClick} fullIssues={data?.fullIssues || {}} />
        </div>
      )}

      <TaskDetailModal issue={selectedIssue} onClose={handleCloseDialog} />
    </div>
  );
}


