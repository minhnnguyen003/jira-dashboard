'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import TaskDetailModal from '@/components/modal/TaskDetailModal';
import LogWorkModal from '@/components/modal/LogWorkModal';
import { useLanguage } from '@/lib/i18n';
import { buildCalendarTaskSegments, getMonthCalendarRange } from '@/lib/calendarTimeline.js';
import { formatDateForInput } from '@/lib/weekPlan.js';
import { JiraIssue } from '@/types/jira';

interface CalendarTask {
  key: string;
  summary: string;
  status: string;
  priority: string;
  startDate: string;
  dueDate: string;
}

interface CalendarResponse {
  issues: CalendarTask[];
  fullIssues?: Record<string, JiraIssue>;
}

interface CalendarSegment {
  task: CalendarTask;
  weekIndex: number;
  startDayIndex: number;
  span: number;
}

const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

function getStatusColor(status: string) {
  const value = status.toLowerCase();
  if (value.includes('done') || value.includes('closed') || value.includes('resolved')) return 'var(--success)';
  if (value.includes('progress')) return 'var(--accent)';
  if (value.includes('cancel')) return 'var(--text-muted)';
  return '#a855f7';
}

async function readIssueByKey(key: string): Promise<JiraIssue> {
  const response = await fetch(`/api/jira/issue?key=${encodeURIComponent(key)}`);
  if (!response.ok) throw new Error(`Không thể tải task: ${response.status}`);
  return response.json();
}

export default function CalendarPage() {
  const { language, t } = useLanguage();
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [tasks, setTasks] = useState<CalendarTask[]>([]);
  const [fullIssues, setFullIssues] = useState<Record<string, JiraIssue>>({});
  const [selectedIssue, setSelectedIssue] = useState<JiraIssue | null>(null);
  const [showLogWorkModal, setShowLogWorkModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const range = useMemo(() => getMonthCalendarRange(month), [month]);
  const visibleDays = useMemo(() => {
    const days: Date[] = [];
    for (let day = new Date(range.start); day <= range.end; day.setDate(day.getDate() + 1)) {
      days.push(new Date(day));
    }
    return days;
  }, [range]);
  const segmentsByWeek = useMemo(() => {
    const grouped = new Map<number, CalendarSegment[]>();
    const calendarSegments = buildCalendarTaskSegments(tasks, range.start, range.end) as CalendarSegment[];
    calendarSegments.forEach((segment) => {
      const current = grouped.get(segment.weekIndex) || [];
      current.push(segment);
      grouped.set(segment.weekIndex, current);
    });
    return grouped;
  }, [range, tasks]);

  useEffect(() => {
    const loadTasks = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          dateField: 'calendarRange',
          from: formatDateForInput(range.start),
          to: formatDateForInput(range.end),
          startAt: '0',
          maxResults: '1000',
          full: 'true',
        });
        const response = await fetch(`/api/jira/work-tasks?${params.toString()}`);
        if (!response.ok) throw new Error(`Lỗi API: ${response.status}`);

        const data: CalendarResponse = await response.json();
        setTasks(data.issues || []);
        setFullIssues(data.fullIssues || {});
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : 'Không thể tải dữ liệu lịch');
      } finally {
        setLoading(false);
      }
    };
    void loadTasks();
  }, [range]);

  const openTaskDetail = useCallback(async (task: CalendarTask) => {
    const cached = fullIssues[task.key];
    if (cached) {
      setSelectedIssue(cached);
      return;
    }
    try {
      const issue = await readIssueByKey(task.key);
      setFullIssues((previous) => ({ ...previous, [issue.key]: issue }));
      setSelectedIssue(issue);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Không thể tải chi tiết task');
    }
  }, [fullIssues]);

  const monthLabel = new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-US', {
    month: 'long',
    year: 'numeric',
  }).format(month);

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4 p-3 sm:p-4" style={{ minHeight: 'calc(100vh - 56px)' }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{t('nav.calendar')}</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-dim)' }}>Task hiển thị theo dải từ ngày bắt đầu đến hạn hoàn thành.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))} className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--border)', color: 'var(--text)', background: 'var(--surface)' }}>←</button>
          <button type="button" onClick={() => { const now = new Date(); setMonth(new Date(now.getFullYear(), now.getMonth(), 1)); }} className="rounded-lg border px-3 py-2 text-sm font-medium" style={{ borderColor: 'var(--border)', color: 'var(--text)', background: 'var(--surface)' }}>Hôm nay</button>
          <button type="button" onClick={() => setMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))} className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--border)', color: 'var(--text)', background: 'var(--surface)' }}>→</button>
        </div>
      </div>

      <h2 className="text-center text-lg font-semibold capitalize" style={{ color: 'var(--text)' }}>{monthLabel}</h2>
      {error && <div className="rounded-xl p-3 text-sm" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>{error}</div>}

      {loading ? (
        <div className="flex flex-1 items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>Đang tải lịch công việc...</div>
      ) : (
        <div className="min-w-0 overflow-x-auto pb-2">
          <div className="min-w-[760px] overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
            <div className="grid grid-cols-7 border-b" style={{ borderColor: 'var(--border)' }}>
              {WEEKDAYS.map((weekday) => <div key={weekday} className="p-2 text-center text-xs font-semibold" style={{ color: 'var(--text-dim)' }}>{weekday}</div>)}
            </div>
            {Array.from({ length: visibleDays.length / 7 }, (_, weekIndex) => {
              const weekDays = visibleDays.slice(weekIndex * 7, weekIndex * 7 + 7);
              const segments = segmentsByWeek.get(weekIndex) || [];
              const weekHeight = Math.max(128, 48 + segments.length * 27);
              return (
                <div key={weekDays[0].toISOString()} className="relative grid grid-cols-7 border-b last:border-b-0" style={{ minHeight: weekHeight, borderColor: 'var(--border)' }}>
                  {weekDays.map((day) => {
                    const isCurrentMonth = day.getMonth() === month.getMonth();
                    const isToday = day.toDateString() === new Date().toDateString();
                    return <div key={day.toISOString()} className="border-r p-2 last:border-r-0" style={{ borderColor: 'var(--border)', background: isCurrentMonth ? 'transparent' : 'rgba(127,127,127,0.06)' }}><span className="inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium" style={{ color: isToday ? 'var(--bg)' : isCurrentMonth ? 'var(--text)' : 'var(--text-muted)', background: isToday ? 'var(--accent)' : 'transparent' }}>{day.getDate()}</span></div>;
                  })}
                  <div className="pointer-events-none absolute inset-x-0 top-9 grid grid-cols-7 gap-y-1 px-1">
                    {segments.map((segment, lane) => (
                      <button key={`${segment.task.key}-${segment.weekIndex}-${segment.startDayIndex}`} type="button" onClick={() => { void openTaskDetail(segment.task); }} className="pointer-events-auto h-6 truncate rounded px-2 text-left text-[11px] font-medium shadow-sm" title={`${segment.task.key}: ${segment.task.summary}`} style={{ gridColumn: `${segment.startDayIndex + 1} / span ${segment.span}`, gridRow: lane + 1, color: 'white', background: getStatusColor(segment.task.status) }}>
                        {segment.task.key} · {segment.task.summary}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <TaskDetailModal issue={selectedIssue} onClose={() => setSelectedIssue(null)} onLogWork={() => setShowLogWorkModal(true)} onRefresh={async (issue) => {
        const refreshed = await readIssueByKey(issue.key);
        setSelectedIssue(refreshed);
        setFullIssues((previous) => ({ ...previous, [refreshed.key]: refreshed }));
        return refreshed;
      }} />
      {showLogWorkModal && selectedIssue && <LogWorkModal issueKey={selectedIssue.key} issueSummary={selectedIssue.fields.summary} originalEstimate={selectedIssue.fields.timeestimate} onClose={() => setShowLogWorkModal(false)} onSuccess={async () => {
        const refreshed = await readIssueByKey(selectedIssue.key);
        setSelectedIssue(refreshed);
        setFullIssues((previous) => ({ ...previous, [refreshed.key]: refreshed }));
      }} />}
    </div>
  );
}
