'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import JiraTable from '@/components/table/JiraTable';
import TaskDetailModal from '@/components/modal/TaskDetailModal';
import LogWorkModal from '@/components/modal/LogWorkModal';
import AssigneeCombobox from '@/components/form/AssigneeCombobox';
import { consumeBrowseUsers, loadBrowseUsers } from './browseUsersLoader.js';
import { DashboardIssue, JiraIssue } from '@/types/jira';
import { useLanguage } from '@/lib/i18n';

interface BrowseTask {
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

interface BrowseTasksResponse {
  issues: BrowseTask[];
  total: number;
  startAt: number;
  maxResults: number;
  fullIssues?: Record<string, JiraIssue>;
}

interface Project {
  key: string;
  name: string;
}

interface IssueType {
  id: string;
  name: string;
}

interface Status {
  id: string;
  name: string;
}

interface JiraUser {
  name: string;
  displayName: string;
  email: string;
}

interface BrowseFilters {
  search: string;
  project: string;
  statuses: string[];
  issueType: string;
  assignee: string;
  startFrom: string;
  startTo: string;
}

const EMPTY_FILTERS: BrowseFilters = {
  search: '',
  project: '',
  statuses: [],
  issueType: '',
  assignee: '',
  startFrom: '',
  startTo: '',
};

const BROWSE_VISIBLE_COLUMNS = ['key', 'summary', 'assignee', 'status', 'priority', 'issuetype', 'estimated', 'originalEstimate', 'logged', 'startDate', 'dueDate', 'resolutionDate'] as const;

function toVNDate(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

function DatePickerField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const pickerRef = useRef<HTMLDivElement>(null);

  const handlePick = useCallback(() => {
    const input = pickerRef.current?.querySelector('input') as HTMLInputElement | null;
    if (input) input.showPicker?.();
  }, []);

  return (
    <div ref={pickerRef} className="relative" style={{ position: 'relative' }}>
      <input
        type="date"
        value={value}
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
        <span>{toVNDate(value) || '-'}</span>
      </div>
    </div>
  );
}

interface FilterPanelProps {
  initialFilters: BrowseFilters;
  projects: Project[];
  issueTypes: IssueType[];
  statuses: Status[];
  users: JiraUser[];
  usersLoading: boolean;
  usersError: boolean;
  expanded: boolean;
  onSubmit: (filters: BrowseFilters) => void;
}

function FilterPanel({ initialFilters, projects, issueTypes, statuses, users, usersLoading, usersError, expanded, onSubmit }: FilterPanelProps) {
  const { t } = useLanguage();
  const [filters, setFilters] = useState<BrowseFilters>(initialFilters);

  const toggleStatus = (name: string) => {
    setFilters((prev) => ({
      ...prev,
      statuses: prev.statuses.includes(name)
        ? prev.statuses.filter((s) => s !== name)
        : [...prev.statuses, name],
    }));
  };

  return (
    <div
      id="browse-tasks-filter-panel"
      aria-hidden={!expanded}
      inert={!expanded ? true : undefined}
      className="glass-card-subtle w-full rounded-2xl overflow-hidden transition-all duration-300 ease-in-out"
      style={{
        maxHeight: expanded ? '70vh' : '0',
        opacity: expanded ? 1 : 0,
        border: expanded ? '1px solid var(--border)' : '0 solid transparent',
        background: 'var(--dropdown-bg)',
        backdropFilter: 'blur(18px) saturate(1.3)',
        pointerEvents: expanded ? 'auto' : 'none',
      }}
    >
      <div
        className="flex max-h-[70vh] flex-col overflow-hidden"
        style={{
          visibility: expanded ? 'visible' : 'hidden',
        }}
      >
        {/* Body: all filters, flowing */}
        <div className="flex-1 overflow-auto p-5">
          <div className="flex flex-col gap-4">
            {/* Row 1: search (full width) */}
            <div className="w-full">
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-dim)' }}>{t('browseTasks.tab.search')}</label>
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                placeholder={t('browseTasks.searchPlaceholder')}
                className="input-field w-full px-3 py-2 text-sm"
              />
            </div>

            {/* Row 2: from date + to date */}
            <div className="flex flex-wrap gap-4">
              <div style={{ flex: '1 1 200px', minWidth: '180px' }}>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-dim)' }}>{t('browseTasks.fromLabel')}</label>
                <DatePickerField
                  value={filters.startFrom}
                  onChange={(v) => setFilters((prev) => ({ ...prev, startFrom: v }))}
                />
              </div>
              <div style={{ flex: '1 1 200px', minWidth: '180px' }}>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-dim)' }}>{t('browseTasks.toLabel')}</label>
                <DatePickerField
                  value={filters.startTo}
                  onChange={(v) => setFilters((prev) => ({ ...prev, startTo: v }))}
                />
              </div>
            </div>

            {/* Row 3: project + issue type + assignee */}
            <div className="flex flex-wrap gap-4">
              <div style={{ flex: '1 1 200px', minWidth: '180px' }}>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-dim)' }}>{t('browseTasks.tab.project')}</label>
                <select
                  value={filters.project}
                  onChange={(e) => setFilters((prev) => ({ ...prev, project: e.target.value }))}
                  className="glass-select w-full px-3 py-2 text-sm"
                >
                  <option value="">{t('browseTasks.all')}</option>
                  {projects.map((p) => (
                    <option key={p.key} value={p.key}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ flex: '1 1 200px', minWidth: '180px' }}>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-dim)' }}>{t('browseTasks.tab.issueType')}</label>
                <select
                  value={filters.issueType}
                  onChange={(e) => setFilters((prev) => ({ ...prev, issueType: e.target.value }))}
                  className="glass-select w-full px-3 py-2 text-sm"
                >
                  <option value="">{t('browseTasks.all')}</option>
                  {issueTypes.map((it) => (
                    <option key={it.id} value={it.name}>{it.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ flex: '1 1 200px', minWidth: '180px' }}>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-dim)' }}>{t('browseTasks.tab.assignee')}</label>
                <AssigneeCombobox
                  users={users}
                  value={filters.assignee}
                  loading={usersLoading}
                  error={usersError}
                  onChange={(assignee) => setFilters((prev) => ({ ...prev, assignee }))}
                />
              </div>
            </div>

            {/* Status multiselect (unchanged) */}
            <div className="w-full">
              <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-dim)' }}>{t('browseTasks.tab.status')}</label>
              <div className="flex flex-wrap gap-1.5">
                {statuses.length === 0 && (
                  <div className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('browseTasks.loading')}</div>
                )}
                {statuses.map((status) => {
                  const checked = filters.statuses.includes(status.name);
                  return (
                    <button
                      key={status.id || status.name}
                      type="button"
                      className="px-3 py-1.5 text-left flex items-center gap-2 rounded-lg transition-all duration-150"
                      style={{
                        background: checked ? 'var(--accent-bg)' : 'transparent',
                        border: `1px solid ${checked ? 'var(--accent-border)' : 'var(--border)'}`,
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => { if (!checked) e.currentTarget.style.background = 'var(--surface-hover)'; }}
                      onMouseLeave={(e) => { if (!checked) e.currentTarget.style.background = 'transparent'; }}
                      onClick={() => toggleStatus(status.name)}
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
                      <span className="text-sm whitespace-nowrap" style={{ color: checked ? 'var(--accent)' : 'var(--text)' }}>{status.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3" style={{ borderTop: '1px solid var(--border)' }}>
          <button
            type="button"
            onClick={() => setFilters(EMPTY_FILTERS)}
            className="text-sm"
            style={{
              padding: '6px 16px',
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
            {t('browseTasks.reset')}
          </button>
          <button
            type="button"
            onClick={() => onSubmit(filters)}
            className="btn-primary text-sm"
            style={{ fontSize: '12px', padding: '6px 16px' }}
          >
            {t('browseTasks.submit')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BrowseTasksPage() {
  const { t } = useLanguage();
  const [tasks, setTasks] = useState<BrowseTask[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [issueTypes, setIssueTypes] = useState<IssueType[]>([]);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [users, setUsers] = useState<JiraUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState(false);
  const [filters, setFilters] = useState<BrowseFilters>(EMPTY_FILTERS);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [fullIssues, setFullIssues] = useState<Record<string, JiraIssue>>({});
  const [selectedIssue, setSelectedIssue] = useState<JiraIssue | null>(null);
  const [showLogWorkModal, setShowLogWorkModal] = useState(false);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    let usersActive = true;

    fetch('/api/jira/projects')
      .then((r) => r.json())
      .then((data) => setProjects(Array.isArray(data) ? data : []))
      .catch(() => {});
    fetch('/api/jira/issue-types')
      .then((r) => r.json())
      .then((data) => setIssueTypes(Array.isArray(data) ? data : []))
      .catch(() => {});
    fetch('/api/jira/statuses')
      .then((r) => r.json())
      .then((data) => setStatuses(Array.isArray(data) ? data : []))
      .catch(() => {});
    void consumeBrowseUsers(loadBrowseUsers(), () => usersActive, {
      onSuccess: setUsers,
      onError: () => setUsersError(true),
      onSettled: () => setUsersLoading(false),
    });

    return () => {
      usersActive = false;
    };
  }, []);

  const fetchTasks = useCallback(async (f: BrowseFilters) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (f.search) params.set('search', f.search);
      if (f.project) params.set('project', f.project);
      if (f.issueType) params.set('issueType', f.issueType);
      f.statuses.forEach((s) => params.append('status', s));
      if (f.assignee) params.set('assignee', f.assignee);
      if (f.startFrom) params.set('startFrom', f.startFrom);
      if (f.startTo) params.set('startTo', f.startTo);
      params.set('startAt', '0');
      params.set('maxResults', '1000');
      params.set('full', 'true');

      const res = await fetch(`/api/jira/browse-tasks?${params.toString()}`);
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data: BrowseTasksResponse = await res.json();
      setTasks(data.issues);
      setTotal(data.total);
      if (data.fullIssues) {
        setFullIssues(data.fullIssues);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      void fetchTasks(EMPTY_FILTERS);
    }
  }, [fetchTasks]);

  const handleSubmitFilters = useCallback((f: BrowseFilters) => {
    setFilters(f);
    void fetchTasks(f);
  }, [fetchTasks]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.search.trim()) count++;
    if (filters.project) count++;
    if (filters.statuses.length > 0) count++;
    if (filters.issueType) count++;
    if (filters.assignee) count++;
    if (filters.startFrom || filters.startTo) count++;
    return count;
  }, [filters]);

  const tableIssues = useMemo<DashboardIssue[]>(() => tasks.map((task) => ({
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
  })), [tasks]);

  const handleTablePageChange = useCallback(() => {
    // JiraTable paginates the loaded tasks client-side.
  }, []);

  const handleTaskClick = useCallback((issue: JiraIssue) => {
    setSelectedIssue(issue);
  }, []);

  const handleCloseDialog = useCallback(() => {
    setSelectedIssue(null);
  }, []);

  const handleRefreshTask = useCallback(async (issue: JiraIssue) => {
    const [, refreshedIssueRes] = await Promise.all([
      fetchTasks(filters),
      fetch(`/api/jira/issue?key=${encodeURIComponent(issue.key)}`),
    ]);

    if (!refreshedIssueRes.ok) {
      throw new Error(`Issue refresh failed: ${refreshedIssueRes.status}`);
    }

    const refreshedIssue: JiraIssue = await refreshedIssueRes.json();
    setSelectedIssue(refreshedIssue);
    setFullIssues((prev) => ({ ...prev, [refreshedIssue.key]: refreshedIssue }));
    return refreshedIssue;
  }, [fetchTasks, filters]);

  const handleOpenLogWork = useCallback(() => {
    setShowLogWorkModal(true);
  }, []);

  const handleCloseLogWork = useCallback(() => {
    setShowLogWorkModal(false);
  }, []);

  const handleLogWorkSuccess = useCallback(async () => {
    if (!selectedIssue) {
      await fetchTasks(filters);
      return;
    }

    await handleRefreshTask(selectedIssue);
  }, [fetchTasks, filters, handleRefreshTask, selectedIssue]);

  return (
    <div className="flex flex-col flex-1 p-4 gap-3" style={{ height: 'calc(100vh - 56px)' }}>
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold" style={{ color: 'var(--text)' }}>
          {t('browseTasks.title')}
          <span className="text-sm font-normal ml-2" style={{ color: 'var(--text-muted)' }}>({tasks.length}/{total} {t('browseTasks.results')})</span>
        </h2>
        <button
          type="button"
          onClick={() => setShowFilterPanel((v) => !v)}
          aria-expanded={showFilterPanel}
          aria-controls="browse-tasks-filter-panel"
          className="flex items-center gap-2 text-sm"
          style={{
            padding: '6px 14px',
            background: activeFilterCount > 0 ? 'var(--accent-bg)' : 'transparent',
            border: `1px solid ${activeFilterCount > 0 ? 'var(--accent-border)' : 'var(--border)'}`,
            borderRadius: '12px',
            color: activeFilterCount > 0 ? 'var(--accent)' : 'var(--text-dim)',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-hover)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = activeFilterCount > 0 ? 'var(--accent-border)' : 'var(--border)';
          }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          <span>{t('browseTasks.filterButton')}</span>
          {activeFilterCount > 0 && (
            <span
              className="flex items-center justify-center text-[10px] font-bold rounded-full"
              style={{ minWidth: '16px', height: '16px', background: 'var(--accent)', color: 'var(--bg)' }}
            >
              {activeFilterCount}
            </span>
          )}
          <svg
            className="w-3.5 h-3.5 transition-transform duration-200"
            style={{ transform: showFilterPanel ? 'rotate(180deg)' : 'rotate(0deg)' }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      <FilterPanel
        initialFilters={filters}
        projects={projects}
        issueTypes={issueTypes}
        statuses={statuses}
        users={users}
        usersLoading={usersLoading}
        usersError={usersError}
        expanded={showFilterPanel}
        onSubmit={handleSubmitFilters}
      />

      {error && (
        <div className="p-3 rounded-lg text-sm" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>
          {error}
        </div>
      )}

      <div className="flex-1 overflow-hidden flex flex-col">
        {loading ? (
          <div className="table-wrap flex items-center justify-center py-16" style={{ color: 'var(--text-muted)' }}>
            {t('browseTasks.loading')}
          </div>
        ) : (
          <JiraTable
            data={tableIssues}
            onPageChange={handleTablePageChange}
            initialVisibleColumns={BROWSE_VISIBLE_COLUMNS}
            columnLabels={{ summary: t('workManagement.column.summary'), originalEstimate: t('workManagement.column.originalEstimate'), logged: t('workManagement.column.logged') }}
            onTaskClick={handleTaskClick}
            fullIssues={fullIssues}
          />
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
