'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, ChartData, ChartOptions } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { useLanguage } from '@/lib/i18n';
import JiraTable from '@/components/table/JiraTable';
import TaskDetailModal from '@/components/modal/TaskDetailModal';
import { DashboardIssue, JiraIssue } from '@/types/jira';
import {
  createHoursByDateInitialState,
  updateHoursByDateDraftRange,
  applyHoursByDateDraftRange,
} from './filterState';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip);

interface DailyHours {
  date: string;
  hours: number;
}

interface DateRangeState {
  draftRange: {
    from: string;
    to: string;
  };
  appliedRange: {
    from: string;
    to: string;
  };
}

function formatDate(dateStr: string) {
  const [, month, day] = dateStr.split('-');
  return `${day}/${month}`;
}

const pad = (n: number) => String(n).padStart(2, '0');

function parseDDMMYYYYToISO(val: string): string | null {
  const parts = val.split('/');
  if (parts.length !== 3) return null;
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);
  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  if (month < 1 || month > 12) return null;
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return `${year}-${pad(month)}-${pad(d.getDate())}`;
}

function isoToDDMMYYYY(iso: string): string {
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

export default function HoursByDatePage() {
  const { t } = useLanguage();
  const today = new Date();
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const monthStart = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-01`;
  const monthEnd = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(lastDay)}`;

  const [dateRangeState, setDateRangeState] = useState<DateRangeState>(() =>
    createHoursByDateInitialState(monthStart, monthEnd)
  );
  const [fromDisplay, setFromDisplay] = useState(isoToDDMMYYYY(monthStart));
  const [toDisplay, setToDisplay] = useState(isoToDDMMYYYY(monthEnd));
  const [data, setData] = useState<DailyHours[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [taskIssues, setTaskIssues] = useState<DashboardIssue[]>([]);
  const [fullIssues] = useState<Record<string, JiraIssue>>({});
  const [taskLoading, setTaskLoading] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<JiraIssue | null>(null);

  const handleFromDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setFromDisplay(val);
    const iso = parseDDMMYYYYToISO(val);
    if (iso) {
      setDateRangeState((prev) => updateHoursByDateDraftRange(prev, { from: iso }));
    }
  };

  const handleToDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setToDisplay(val);
    const iso = parseDDMMYYYYToISO(val);
    if (iso) {
      setDateRangeState((prev) => updateHoursByDateDraftRange(prev, { to: iso }));
    }
  };

  const fetchDataForRange = useCallback(async (from: string, to: string) => {
    if (!from || !to) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/jira/hours-by-date?from=${from}&to=${to}`);
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const result = await res.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchData = useCallback(async () => {
    const { from, to } = dateRangeState.appliedRange;
    await fetchDataForRange(from, to);
  }, [dateRangeState.appliedRange, fetchDataForRange]);

  const fetchTasksForDate = useCallback(async (date: string) => {
    setTaskLoading(true);
    try {
      const res = await fetch(`/api/jira/hours-by-date?selectedDate=${date}&maxResults=100`);
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const result = await res.json();
      setTaskIssues(result.issues || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch tasks');
      setTaskIssues([]);
    } finally {
      setTaskLoading(false);
    }
  }, []);

  useEffect(() => {
    const { from, to } = dateRangeState.appliedRange;
    const timer = window.setTimeout(() => {
      void fetchDataForRange(from, to);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [dateRangeState.appliedRange, fetchDataForRange]);

  const handleBarClick = useCallback((dateStr: string) => {
    setSelectedDate((prev) => {
      if (prev === dateStr) {
        return null;
      }
      fetchTasksForDate(dateStr);
      return dateStr;
    });
  }, [fetchTasksForDate]);

  const chartKey = useMemo(() => {
    const { from, to } = dateRangeState.appliedRange;
    return `${data.length}-${from}-${to}`;
  }, [data.length, dateRangeState.appliedRange]);

  const totalHours = useMemo(() => {
    return Math.round((data.reduce((s, d) => s + d.hours, 0) * 100) / 100);
  }, [data]);

  const workingDays = data.length;

  const avgHours = useMemo(() => {
    if (workingDays === 0) return 0;
    return Math.round((totalHours / workingDays) * 100) / 100;
  }, [totalHours, workingDays]);

  const isLight = useMemo(() => {
    return typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light';
  }, []);

  const handleExportChart = useCallback(() => {
    const canvas = document.querySelector('#chart-container canvas');
    if (!(canvas instanceof HTMLCanvasElement)) return;
    const { from, to } = dateRangeState.appliedRange;
    const link = document.createElement('a');
    link.download = `hours-by-date-${from}-to-${to}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }, [dateRangeState.appliedRange]);

  const handleRefresh = useCallback(() => {
    setDateRangeState((prev) => {
      const next = applyHoursByDateDraftRange(prev);
      const hasRangeChanged =
        next.appliedRange.from !== prev.appliedRange.from ||
        next.appliedRange.to !== prev.appliedRange.to;

      if (hasRangeChanged) {
        void fetchDataForRange(next.appliedRange.from, next.appliedRange.to);
        return next;
      }

      void fetchData();
      return prev;
    });
  }, [fetchData, fetchDataForRange]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F8' && !e.shiftKey) {
        e.preventDefault();
        handleRefresh();
      } else if (e.key === 'F8' && e.shiftKey) {
        e.preventDefault();
        handleExportChart();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleExportChart, handleRefresh]);

  const chartData: ChartData<'bar'> = useMemo(() => ({
    labels: data.map((d) => formatDate(d.date)),
    datasets: [
      {
        data: data.map((d) => d.hours),
        backgroundColor: isLight ? 'rgba(124,111,240,0.7)' : 'rgba(164,148,245,0.75)',
        borderColor: isLight ? 'rgba(124,111,240,0.9)' : 'rgba(164,148,245,0.9)',
        borderWidth: 1,
        borderRadius: 4,
        borderSkipped: false,
        barThickness: 24,
      },
    ],
  }), [data, isLight]);

  const handleTaskClick = useCallback((issue: JiraIssue) => {
    setSelectedIssue(issue);
  }, []);

  const handleCloseModal = useCallback(() => {
    setSelectedIssue(null);
  }, []);

  const options: ChartOptions<'bar'> = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 1000,
      easing: 'easeOutQuart',
    },
    layout: {
      padding: {
        top: 8,
        bottom: 4,
      },
    },
    plugins: {
      legend: { display: false },
      title: {
        display: true,
        text: t('hoursByDate.title'),
        color: isLight ? '#2a2e3a' : '#e6e8ec',
        font: { size: 13, weight: 'bold' },
        padding: { top: 4, bottom: 8 },
      },
      tooltip: {
        backgroundColor: isLight ? 'rgba(255,255,255,0.95)' : 'rgba(17,20,28,0.9)',
        titleColor: isLight ? '#1a1d26' : '#e6e8ec',
        bodyColor: isLight ? '#5a6070' : '#8d919c',
        borderColor: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        cornerRadius: 8,
        padding: 10,
        callbacks: {
          title: (items) => `Ngày ${items[0].label}`,
          label: (ctx) => {
            const hours = Number(ctx.raw);
            return `Số giờ: ${hours}h`;
          },
        },
      },
    },
    scales: {
      x: {
        type: 'category',
        ticks: {
          color: isLight ? '#6b7080' : '#8d919c',
          font: { size: 10 },
          autoSkip: false,
          maxRotation: 45,
          minRotation: 45,
        },
        grid: { display: false },
        border: { display: false },
      },
      y: {
        beginAtZero: true,
        ticks: {
          color: isLight ? '#6b7080' : '#8d919c',
          font: { size: 10 },
          callback: (value) => `${Number(value).toFixed(1)}h`,
        },
        grid: { color: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)' },
        border: { display: false },
      },
    },
    onClick: (event, elements) => {
      if (elements.length > 0) {
        const index = elements[0].index;
        const dateStr = data[index]?.date;
        if (dateStr) handleBarClick(dateStr);
      }
    },
    onHover: (event, elements) => {
      if (event.native?.target instanceof HTMLElement) {
        event.native.target.style.cursor = elements.length > 0 ? 'pointer' : 'default';
      }
    },
  }), [isLight, t, data, handleBarClick]);

  return (
    <div className="flex flex-col flex-1 p-6">
      <div className="mb-6 animate-slide-up">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{t('hoursByDate.title')}</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-dim)' }}>{t('hoursByDate.subtitle')}</p>
      </div>

      <div className="flex flex-col animate-slide-up mb-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-dim)' }}>{t('hoursByDate.fromLabel')}</label>
            <input
              type="text"
              value={fromDisplay}
              onChange={handleFromDateChange}
              placeholder={t('hoursByDate.placeholder')}
              className="input-field px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-dim)' }}>{t('hoursByDate.toLabel')}</label>
            <input
              type="text"
              value={toDisplay}
              onChange={handleToDateChange}
              placeholder={t('hoursByDate.placeholder')}
              className="input-field px-3 py-2 text-sm"
            />
          </div>
        </div>
        {data.length > 0 && (
          <div className="mt-1">
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{t('hoursByDate.exportHint')}</span>
          </div>
        )}
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

      {!loading && !error && data.length > 0 && (
        <div className="flex flex-col animate-slide-up flex-1">
          <div className="mb-4 flex flex-wrap gap-4">
            <div className="metric-card p-3 flex-1 min-w-[140px]">
              <div className="text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{t('hoursByDate.totalHours')}</div>
              <div className="text-xl font-bold mt-1" style={{ color: 'var(--success)' }}>{totalHours}h</div>
            </div>
            <div className="metric-card p-3 flex-1 min-w-[140px]">
              <div className="text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{t('hoursByDate.workingDays')}</div>
              <div className="text-xl font-bold mt-1" style={{ color: 'var(--text)' }}>{workingDays}</div>
            </div>
            <div className="metric-card p-3 flex-1 min-w-[140px]">
              <div className="text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{t('hoursByDate.avgHours')}</div>
              <div className="text-xl font-bold mt-1" style={{ color: 'var(--accent)' }}>{avgHours}h</div>
            </div>
          </div>

          <div id="chart-container" className="glass-card-subtle p-5 flex-1 min-h-0" style={{ position: 'relative', overflow: 'hidden' }}>
            <Bar key={chartKey} data={chartData} options={options} />
          </div>
        </div>
      )}

      {selectedDate && (
        <div className="mt-6 animate-slide-up">
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>
              {t('hoursByDate.tasksForDate')}: {isoToDDMMYYYY(selectedDate)}
            </h2>
            <button
              type="button"
              onClick={() => setSelectedDate(null)}
              className="text-xs px-3 py-1 rounded-lg"
              style={{
                color: 'var(--text-muted)',
                background: 'var(--surface-light)',
                border: '1px solid var(--border)',
                cursor: 'pointer',
              }}
            >
              x
            </button>
          </div>

          {taskLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-pulse text-sm" style={{ color: 'var(--text-muted)' }}>{t('jql.loading')}</div>
            </div>
          )}

          {!taskLoading && taskIssues.length > 0 && (
            <JiraTable
              data={taskIssues}
              onPageChange={() => {}}
              onTaskClick={handleTaskClick}
              fullIssues={fullIssues}
            />
          )}

          {!taskLoading && taskIssues.length === 0 && (
            <div className="text-center py-12 text-sm" style={{ color: 'var(--text-muted)' }}>{t('hoursByDate.noTasks')}</div>
          )}
        </div>
      )}

      {!loading && !error && data.length === 0 && (
        <div className="flex-1 flex items-center justify-center py-20 animate-slide-up">
          <div className="text-center empty-state p-8 max-w-md">
            <svg className="w-10 h-10 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--text-muted)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-dim)' }}>{t('hoursByDate.emptyTitle')}</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('hoursByDate.emptySubtitle')}</p>
          </div>
        </div>
      )}

      <TaskDetailModal issue={selectedIssue} onClose={handleCloseModal} />
    </div>
  );
}
