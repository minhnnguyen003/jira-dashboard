'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import JiraTable from '@/components/table/JiraTable';
import TaskDetailModal from '@/components/modal/TaskDetailModal';
import LogWorkModal from '@/components/modal/LogWorkModal';
import { DashboardIssue, JiraIssue } from '@/types/jira';
import { useLanguage } from '@/lib/i18n';

interface WorkTask {
  key: string;
  summary: string;
  status: string;
  issuetype: string;
  assignee: string;
  priority: string;
  description: string;
  originalEstimate: string;
  remaining: string;
  logged: string;
  startDate: string;
  dueDate: string;
  resolutionDate: string;
}

interface WorkTasksResponse {
  issues: WorkTask[];
  total: number;
  startAt: number;
  maxResults: number;
}

interface Project {
  key: string;
  name: string;
}

interface IssueType {
  id: string;
  name: string;
}

type DateFieldOption = 'startDate' | 'created' | 'updated' | 'endDate';

const DATE_FIELD_OPTIONS: Array<{ value: DateFieldOption; label: string }> = [
  { value: 'startDate', label: 'Start Date' },
  { value: 'created', label: 'Creation Date' },
  { value: 'updated', label: 'Lasted Update' },
  { value: 'endDate', label: 'End Date' },
];

const WORK_VISIBLE_COLUMNS = ['key', 'summary', 'assignee', 'status', 'priority', 'issuetype', 'estimated', 'originalEstimate', 'logged', 'startDate', 'dueDate', 'resolutionDate'] as const;

const WORK_COLUMN_LABELS = {
  summary: 'Tên Task',
  assignee: 'Assignee',
  priority: 'Priority',
  issuetype: 'Loại Issue',
  estimated: 'Estimate',
  originalEstimate: 'Còn lại',
  logged: 'Đã log',
  startDate: 'StartDate',
  dueDate: 'DueDate',
  resolutionDate: 'ResolutionDate',
};

function formatDateLocal(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDefaultFrom() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return formatDateLocal(d);
}

function getDefaultTo() {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  d.setHours(23, 59, 59, 999);
  return formatDateLocal(d);
}

function toVNDate(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

function DatePickerField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const pickerRef = useRef<HTMLDivElement>(null);
  const displayValue = toVNDate(value);

  const handlePick = useCallback(() => {
    const input = pickerRef.current?.querySelector('input') as HTMLInputElement | null;
    if (input) input.showPicker?.();
  }, []);

  return (
    <div ref={pickerRef} className="relative" style={{ position: 'relative' }}>
      <input
        type="date"
        onChange={(e) => onChange(e.target.value)}
        tabIndex={-1}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          opacity: 0,
          cursor: 'pointer',
          pointerEvents: 'auto',
          margin: 0,
        }}
      />
      <div
        className="input-field w-full px-3 py-2 text-sm flex items-center gap-1.5"
        style={{ cursor: 'pointer', position: 'relative', zIndex: 1 }}
        onClick={handlePick}
      >
        <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span>{displayValue || '-'}</span>
      </div>
    </div>
  );
}

export default function WorkManagementPage() {
  const { t } = useLanguage();
  const [tasks, setTasks] = useState<WorkTask[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [issueTypes, setIssueTypes] = useState<IssueType[]>([]);
  const hasLoadedRef = useRef(false);
  const defaultFrom = useMemo(() => getDefaultFrom(), []);
  const defaultTo = useMemo(() => getDefaultTo(), []);

  const [searchText, setSearchText] = useState('');
  const [fromDate, setFromDate] = useState(defaultFrom);
  const [toDate, setToDate] = useState(defaultTo);
  const [dateField, setDateField] = useState<DateFieldOption>('startDate');
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedIssueType, setSelectedIssueType] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [appliedStatuses, setAppliedStatuses] = useState<string[]>([]);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const [fullIssues, setFullIssues] = useState<Record<string, JiraIssue>>({});
  const [selectedIssue, setSelectedIssue] = useState<JiraIssue | null>(null);
  const [showLogWorkModal, setShowLogWorkModal] = useState(false);



  useEffect(() => {
    fetch('/api/jira/projects')
      .then((r) => r.json())
      .then((data) => setProjects(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/jira/issue-types')
      .then((r) => r.json())
      .then((data) => setIssueTypes(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target as Node)) {
        setShowStatusDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (searchText) params.set('search', searchText);
      if (fromDate) params.set('from', fromDate);
      if (toDate) params.set('to', toDate);
      params.set('dateField', dateField);
      if (selectedProject) params.set('project', selectedProject);
      if (selectedIssueType) params.set('issueType', selectedIssueType);
      params.set('startAt', '0');
      params.set('maxResults', '1000');

      const res = await fetch(`/api/jira/work-tasks?${params.toString()}&full=true`);
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data: WorkTasksResponse & { fullIssues?: Record<string, JiraIssue> } = await res.json();
      setTasks(data.issues);
      setTotal(data.total);
      setAppliedStatuses(selectedStatuses);
      if (data.fullIssues) {
        setFullIssues(data.fullIssues);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  }, [searchText, fromDate, toDate, dateField, selectedProject, selectedIssueType, selectedStatuses]);

  useEffect(() => {
    if (projects.length > 0 && issueTypes.length > 0 && !hasLoadedRef.current) {
      hasLoadedRef.current = true;
      void fetchTasks();
    }
  }, [projects, issueTypes, fetchTasks]);

  const handleRefresh = useCallback(() => {
    void fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F8') {
        e.preventDefault();
        handleRefresh();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleRefresh]);

  const availableStatuses = useMemo(
    () => Array.from(new Set(tasks.map((t) => t.status).filter(Boolean))).sort(),
    [tasks]
  );

  const toggleStatus = (status: string) => {
    setSelectedStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  };

  const tableIssues = useMemo<DashboardIssue[]>(() => tasks
    .filter((task) => appliedStatuses.length === 0 || appliedStatuses.includes(task.status))
    .map((task) => ({
    key: task.key,
    id: task.key,
    summary: task.summary,
    status: task.status,
    assignee: task.assignee,
    priority: task.priority,
    issuetype: task.issuetype,
    estimated: task.originalEstimate,
    originalEstimate: task.remaining,
    logged: task.logged,
    resolutionDate: task.resolutionDate || '-',
    created: '-',
    updated: '-',
    sprint: '-',
    epic: task.description || '-',
    labels: [],
    resolution: '-',
    startDate: task.startDate || '-',
    dueDate: task.dueDate || '-',
  })), [tasks, appliedStatuses]);

  const handleTablePageChange = useCallback(() => {
    // JiraTable paginates the loaded work tasks client-side.
  }, []);

  const handleTaskClick = useCallback((issue: JiraIssue) => {
    setSelectedIssue(issue);
  }, []);

  const handleCloseDialog = useCallback(() => {
    setSelectedIssue(null);
  }, []);

  const handleRefreshTask = useCallback(async (issue: JiraIssue) => {
    const [_, refreshedIssueRes] = await Promise.all([
      fetchTasks(),
      fetch(`/api/jira/issue?key=${encodeURIComponent(issue.key)}`),
    ]);

    if (!refreshedIssueRes.ok) {
      throw new Error(`Issue refresh failed: ${refreshedIssueRes.status}`);
    }

    const refreshedIssue: JiraIssue = await refreshedIssueRes.json();
    setSelectedIssue(refreshedIssue);
    setFullIssues((prev) => ({ ...prev, [refreshedIssue.key]: refreshedIssue }));
    return refreshedIssue;
  }, [fetchTasks]);

  const handleOpenLogWork = useCallback(() => {
    setShowLogWorkModal(true);
  }, []);

  const handleCloseLogWork = useCallback(() => {
    setShowLogWorkModal(false);
  }, []);

  const handleLogWorkSuccess = useCallback(async () => {
    if (!selectedIssue) {
      await fetchTasks();
      return;
    }

    await handleRefreshTask(selectedIssue);
  }, [fetchTasks, handleRefreshTask, selectedIssue]);

  return (
    <div className="flex flex-1 p-4 gap-4" style={{ height: 'calc(100vh - 56px)' }}>
      <div className="flex-shrink-0 overflow-y-auto" style={{ width: '20%', overflowX: 'visible' }}>
        <div className="glass-card-subtle p-4 mt-8 space-y-4" style={{ maxHeight: 'calc(100vh - 80px)', overflow: 'visible' }}>
          <h2 className="text-base font-bold" style={{ color: 'var(--text)' }}>{t('workManagement.filterTitle')}</h2>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-dim)' }}>{t('workManagement.searchLabel')}</label>
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder={t('workManagement.searchPlaceholder')}
              className="input-field w-full px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-dim)' }}>{t('workManagement.fromLabel')}</label>
              <DatePickerField
                value={fromDate}
                onChange={(v) => setFromDate(v)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-dim)' }}>{t('workManagement.toLabel')}</label>
              <DatePickerField
                value={toDate}
                onChange={(v) => setToDate(v)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-dim)' }}>Date Field</label>
            <select
              value={dateField}
              onChange={(e) => setDateField(e.target.value as DateFieldOption)}
              className="glass-select w-full px-3 py-2 text-sm"
            >
              {DATE_FIELD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-dim)' }}>{t('workManagement.projectLabel')}</label>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="glass-select w-full px-3 py-2 text-sm"
            >
              <option value="">{t('workManagement.all')}</option>
              {projects.map((p) => (
                <option key={p.key} value={p.key}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-dim)' }}>{t('workManagement.issueTypeLabel')}</label>
            <select
              value={selectedIssueType}
              onChange={(e) => setSelectedIssueType(e.target.value)}
              className="glass-select w-full px-3 py-2 text-sm"
            >
              <option value="">{t('workManagement.all')}</option>
              {issueTypes.map((t) => (
                <option key={t.id} value={t.name}>{t.name}</option>
              ))}
            </select>
          </div>

          {availableStatuses.length > 0 && (
            <div
              ref={statusDropdownRef}
              style={{
                position: 'relative',
                zIndex: showStatusDropdown ? 20 : 1,
              }}
            >
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-dim)' }}>{t('workManagement.statusLabel')}</label>
              {/* Trigger */}
              <button
                type="button"
                onClick={() => setShowStatusDropdown((v) => !v)}
                className="glass-select w-full px-3 py-2 text-sm flex items-center justify-between gap-2"
                style={{ cursor: 'pointer', textAlign: 'left' }}
              >
                <span className="truncate" style={{ color: selectedStatuses.length > 0 ? 'var(--text)' : 'var(--text-muted)' }}>
                  {selectedStatuses.length === 0
                    ? t('workManagement.all')
                    : selectedStatuses.length === 1
                      ? selectedStatuses[0]
                      : `${selectedStatuses.length} trạng thái`}
                </span>
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--text-muted)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {/* Dropdown list */}
              {showStatusDropdown && (
                <div
                  className="absolute top-full left-0 mt-1 w-full rounded-xl z-[200]"
                  style={{
                    background: 'var(--dropdown-bg)',
                    border: '1px solid var(--border)',
                    backdropFilter: 'blur(18px) saturate(1.3)',
                    maxHeight: '220px',
                    overflowY: 'auto',
                  }}
                >
                  {availableStatuses.map((status) => {
                    const checked = selectedStatuses.includes(status);
                    return (
                      <button
                        key={status}
                        type="button"
                        className="w-full px-3 py-2 text-left flex items-center gap-2.5 transition-all duration-150"
                        style={{ background: checked ? 'var(--accent-bg)' : 'transparent', cursor: 'pointer' }}
                        onMouseEnter={(e) => { if (!checked) e.currentTarget.style.background = 'var(--surface-hover)'; }}
                        onMouseLeave={(e) => { if (!checked) e.currentTarget.style.background = 'transparent'; }}
                        onClick={() => toggleStatus(status)}
                      >
                        <span
                          className="flex-shrink-0 w-3.5 h-3.5 rounded flex items-center justify-center"
                          style={{
                            border: checked ? 'none' : '1.5px solid var(--border)',
                            background: checked ? 'var(--accent)' : 'transparent',
                          }}
                        >
                          {checked && (
                            <svg className="w-2.5 h-2.5" fill="none" stroke="white" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </span>
                        <span className="text-sm" style={{ color: checked ? 'var(--accent)' : 'var(--text)' }}>{status}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                setSearchText('');
                setSelectedProject('');
                setSelectedIssueType('');
                setSelectedStatuses([]);
                setFromDate(defaultFrom);
                setToDate(defaultTo);
              }}
              className="w-full text-sm"
              style={{
                padding: '6px 12px',
                background: 'transparent',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                color: 'var(--text-dim)',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-hover)';
                e.currentTarget.style.color = 'var(--text)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.color = 'var(--text-dim)';
              }}
            >
              {t('workManagement.clearFilter')}
            </button>
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="btn-primary w-full text-sm"
              style={{ fontSize: '12px', padding: '6px 12px' }}
            >
              {loading ? t('workManagement.loading') : t('workManagement.refresh')}
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold" style={{ color: 'var(--text)' }}>
            {t('workManagement.title')}
            <span className="text-sm font-normal ml-2" style={{ color: 'var(--text-muted)' }}>({tasks.length}/{total} {t('workManagement.results')})</span>
          </h2>
        </div>

        {error && (
          <div className="mb-3 p-3 rounded-lg text-sm" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div className="table-wrap flex items-center justify-center py-16" style={{ color: 'var(--text-muted)' }}>
            {t('workManagement.loading')}
          </div>
        ) : (
          <JiraTable data={tableIssues} onPageChange={handleTablePageChange} initialVisibleColumns={WORK_VISIBLE_COLUMNS} columnLabels={{ summary: t('workManagement.column.summary'), originalEstimate: t('workManagement.column.originalEstimate'), logged: t('workManagement.column.logged') }} onTaskClick={handleTaskClick} fullIssues={fullIssues} />
        )}
      </div>

      <TaskDetailModal issue={selectedIssue} onClose={handleCloseDialog} onLogWork={handleOpenLogWork} onRefresh={handleRefreshTask} />

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
