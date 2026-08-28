'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import TaskDetailModal from '@/components/modal/TaskDetailModal';
import LogWorkModal from '@/components/modal/LogWorkModal';
import { JiraIssue } from '@/types/jira';
import { formatDateForInput, getCurrentWeekRange, groupWeekPlanTasks, WEEK_PLAN_COLUMNS } from '@/lib/weekPlan.js';
import { useLanguage } from '@/lib/i18n';

interface WeekPlanTask {
  key: string;
  summary: string;
  status: string;
  priority: string;
  startDate: string;
  dueDate: string;
}

interface WeekPlanResponse {
  issues: WeekPlanTask[];
  total: number;
}

const WEEK_PLAN_COLUMN_WIDTH = 240;
const WEEK_PLAN_COLUMN_GAP = 16;
const WEEK_PLAN_GRID_MIN_WIDTH = (WEEK_PLAN_COLUMNS.length * WEEK_PLAN_COLUMN_WIDTH)
  + ((WEEK_PLAN_COLUMNS.length - 1) * WEEK_PLAN_COLUMN_GAP);

function formatDateLabel(value: string) {
  return value && value !== '-' ? value : '—';
}

async function readIssueByKey(key: string): Promise<JiraIssue> {
  const response = await fetch(`/api/jira/issue?key=${encodeURIComponent(key)}`);
  if (!response.ok) {
    throw new Error(`Issue refresh failed: ${response.status}`);
  }

  return response.json();
}

export default function WeeklyPlanPage() {
  const { t } = useLanguage();
  const [tasks, setTasks] = useState<WeekPlanTask[]>([]);
  const [fullIssues, setFullIssues] = useState<Record<string, JiraIssue>>({});
  const [selectedIssue, setSelectedIssue] = useState<JiraIssue | null>(null);
  const [showLogWorkModal, setShowLogWorkModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const weekRange = useMemo(() => getCurrentWeekRange(), []);

  useEffect(() => {
    const fetchWeekPlan = async () => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          dateField: 'endDate',
          from: formatDateForInput(weekRange.start),
          to: formatDateForInput(weekRange.end),
          startAt: '0',
          maxResults: '1000',
        });

        const response = await fetch(`/api/jira/work-tasks?${params.toString()}&full=true`);
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const data: WeekPlanResponse & { fullIssues?: Record<string, JiraIssue> } = await response.json();
        setTasks(data.issues || []);
        if (data.fullIssues) {
          setFullIssues(data.fullIssues);
        }
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : 'Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };

    void fetchWeekPlan();
  }, [weekRange.end, weekRange.start]);

  const groupedTasks = useMemo<Record<string, WeekPlanTask[]>>(() => groupWeekPlanTasks(tasks), [tasks]);

  const handleOpenTaskDetail = useCallback(async (task: WeekPlanTask) => {
    const cachedIssue = fullIssues[task.key];
    if (cachedIssue) {
      setSelectedIssue(cachedIssue);
      return;
    }

    try {
      const issue = await readIssueByKey(task.key);
      setFullIssues((previous) => ({ ...previous, [issue.key]: issue }));
      setSelectedIssue(issue);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to load issue detail');
    }
  }, [fullIssues]);

  const handleOpenLogWork = useCallback(() => {
    setShowLogWorkModal(true);
  }, []);

  const handleCloseLogWork = useCallback(() => {
    setShowLogWorkModal(false);
  }, []);

  const handleLogWorkSuccess = useCallback(async () => {
    if (!selectedIssue) return;
    const refreshedIssue = await readIssueByKey(selectedIssue.key);
    setSelectedIssue(refreshedIssue);
    setFullIssues((previous) => ({ ...previous, [refreshedIssue.key]: refreshedIssue }));
  }, [selectedIssue]);

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4 p-3 sm:p-4" style={{ minHeight: 'calc(100vh - 56px)' }}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{t('nav.weeklyPlan')}</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-dim)' }}>
            Lọc theo Due Date từ {formatDateForInput(weekRange.start)} đến {formatDateForInput(weekRange.end)}.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl p-3 text-sm" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>
          Đang tải task theo tuần...
        </div>
      ) : (
        <div className="min-w-0 flex-1 overflow-x-auto pb-2">
          <div
            className="grid gap-4"
            style={{
              gridTemplateColumns: `repeat(${WEEK_PLAN_COLUMNS.length}, minmax(${WEEK_PLAN_COLUMN_WIDTH}px, 1fr))`,
              minWidth: WEEK_PLAN_GRID_MIN_WIDTH,
              alignItems: 'start',
            }}
          >
          {WEEK_PLAN_COLUMNS.map((columnName) => (
            <div key={columnName} className="flex min-h-[420px] min-w-0 flex-col rounded-2xl border p-3" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
              <div className="mb-3 flex min-w-0 items-center justify-between gap-2">
                <span className="min-w-0 truncate text-sm font-semibold" style={{ color: 'var(--text)' }} title={columnName}>{columnName}</span>
                <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px]" style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}>
                  {groupedTasks[columnName]?.length || 0}
                </span>
              </div>

              <div className="space-y-3">
                {(groupedTasks[columnName] || []).map((task) => (
                  <button
                    key={task.key}
                    type="button"
                    onClick={() => {
                      void handleOpenTaskDetail(task);
                    }}
                    className="w-full rounded-xl border p-3 text-left shadow-sm transition-all duration-150"
                    style={{ borderColor: 'var(--border)', background: 'var(--surface-hover)', cursor: 'pointer' }}
                    onMouseEnter={(event) => {
                      event.currentTarget.style.borderColor = 'var(--accent)';
                      event.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={(event) => {
                      event.currentTarget.style.borderColor = 'var(--border)';
                      event.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}>
                        {task.status}
                      </span>
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-dim)' }}>
                        {task.priority || 'None'}
                      </span>
                    </div>
                    <div className="mt-2 break-words text-sm font-semibold [overflow-wrap:anywhere]" style={{ color: 'var(--text)' }}>{task.summary}</div>
                    <div className="mt-2 text-xs" style={{ color: 'var(--text-dim)' }}>
                      <div className="flex items-center justify-between gap-2">
                        <span>Start</span>
                        <span>{formatDateLabel(task.startDate)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-1">
                        <span>Due</span>
                        <span>{formatDateLabel(task.dueDate)}</span>
                      </div>
                    </div>
                  </button>
                ))}

                {(groupedTasks[columnName] || []).length === 0 && (
                  <div className="rounded-xl border border-dashed px-3 py-8 text-center text-xs" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                    Không có task
                  </div>
                )}
              </div>
            </div>
          ))}
          </div>
        </div>
      )}

      <TaskDetailModal
        issue={selectedIssue}
        onClose={() => setSelectedIssue(null)}
        onLogWork={handleOpenLogWork}
        onRefresh={async (issue) => {
          const refreshedIssue = await readIssueByKey(issue.key);
          setSelectedIssue(refreshedIssue);
          setFullIssues((previous) => ({ ...previous, [refreshedIssue.key]: refreshedIssue }));
          return refreshedIssue;
        }}
      />

      {showLogWorkModal && selectedIssue && (
        <LogWorkModal
          issueKey={selectedIssue.key}
          issueSummary={selectedIssue.fields.summary}
          originalEstimate={selectedIssue.fields.timeestimate}
          onClose={handleCloseLogWork}
          onSuccess={handleLogWorkSuccess}
        />
      )}
    </div>
  );
}
