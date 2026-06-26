'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useLanguage } from '@/lib/i18n';

interface Project { key: string; name: string; }
interface User { name: string; displayName: string; }
interface Epic { key: string; summary: string; }
interface TaskOption { key: string; summary: string; status: string; }
interface Sprint { id: number; name: string; state: string; }

interface TaskForm {
  project: string;
  summary: string;
  description: string;
  issuetype: string;
  priority: string;
  assignee: string;
  labels: string;
  parent: string;
  customFieldSprint: string;
  originalEstimate: string;
  remainingEstimate: string;
  startDate: string;
  dueDate: string;
}

interface CreateTaskModalProps {
  onClose: () => void;
}

const issueTypeOptions = ['Task', 'Story', 'Sub-task', 'Bug', 'Epic'] as const;
const priorityOptions = ['Highest', 'High', 'Medium', 'Low', 'Lowest'] as const;
const jiraBaseUrl = (process.env.NEXT_PUBLIC_JIRA_BASE_URL || '').replace(/\/+$/, '');

const DARK = {
  cardBg: 'rgba(20,22,40,0.92)',
  backdropBlur: 'rgba(0,0,0,0.75)',
  border: 'rgba(255,255,255,0.1)',
  borderRow: 'rgba(255,255,255,0.08)',
  textPrimary: '#e8eaf0',
  textSecondary: '#9095a8',
  textMuted: '#5a5f6e',
  cardBgInner: 'rgba(20,22,40,0.4)',
};

const LIGHT = {
  cardBg: 'rgba(255,255,255,0.95)',
  backdropBlur: 'rgba(0,0,0,0.3)',
  border: 'rgba(0,0,0,0.1)',
  borderRow: 'rgba(0,0,0,0.06)',
  textPrimary: '#1a1c28',
  textSecondary: '#5a5f70',
  textMuted: '#7a7f90',
  cardBgInner: 'rgba(255,255,255,0.6)',
};

function FieldLabel({ label, c }: { label: string; c: typeof DARK }) {
  return (
    <div className="text-[11px] font-medium uppercase tracking-wider mb-1.5" style={{ color: c.textMuted }}>
      {label}
    </div>
  );
}

export default function CreateTaskModal({ onClose }: CreateTaskModalProps) {
  const { t } = useLanguage();
  const [isLight, setIsLight] = useState(false);

  useEffect(() => {
    setIsLight(document.documentElement.getAttribute('data-theme') === 'light');
    const observer = new MutationObserver(() => {
      setIsLight(document.documentElement.getAttribute('data-theme') === 'light');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  const c = isLight ? LIGHT : DARK;

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const todayMorning = `${todayStr}T08:00`;
  const todayEvening = `${todayStr}T17:00`;

  const [form, setForm] = useState<TaskForm>({
    project: '', summary: '', description: '', issuetype: 'Task', priority: '',
    assignee: '', labels: '', parent: '', customFieldSprint: '',
    originalEstimate: '1d', remainingEstimate: '1d',
    startDate: todayMorning, dueDate: todayEvening,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  // Data
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectLoading, setProjectLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [userLoading, setUserLoading] = useState(false);
  const [epics, setEpics] = useState<Epic[]>([]);
  const [epicLoading, setEpicLoading] = useState(false);
  const [parentTasks, setParentTasks] = useState<TaskOption[]>([]);
  const [parentTaskLoading, setParentTaskLoading] = useState(false);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [sprintLoading, setSprintLoading] = useState(false);

  // Dropdowns
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showEpicDropdown, setShowEpicDropdown] = useState(false);
  const [showSprintDropdown, setShowSprintDropdown] = useState(false);
  const [showIssueTypeDropdown, setShowIssueTypeDropdown] = useState(false);
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);

  // Filters
  const [projectFilter, setProjectFilter] = useState('');
  const [epicFilter, setEpicFilter] = useState('');
  const [sprintFilter, setSprintFilter] = useState('');
  const [issueTypeFilter, setIssueTypeFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');

  const projectRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);
  const epicRef = useRef<HTMLDivElement>(null);
  const sprintRef = useRef<HTMLDivElement>(null);
  const issueTypeRef = useRef<HTMLDivElement>(null);
  const priorityRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    setProjectLoading(true);
    fetch('/api/jira/projects')
      .then((r) => r.json()).then(setProjects).catch(() => {})
      .finally(() => setProjectLoading(false));
  }, []);

  useEffect(() => {
    if (!form.assignee) { setUsers([]); return; }
    const timer = setTimeout(() => {
      setUserLoading(true);
      fetch(`/api/jira/users?query=${encodeURIComponent(form.assignee)}`)
        .then((r) => r.json()).then(setUsers).catch(() => {})
        .finally(() => setUserLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [form.assignee]);

  useEffect(() => {
    if (!form.project) { setEpics([]); setParentTasks([]); setEpicFilter(''); return; }
    const timer = setTimeout(() => {
      if (form.issuetype === 'Sub-task') {
        setParentTaskLoading(true);
        fetch(`/api/jira/tasks?project=${encodeURIComponent(form.project)}&query=${encodeURIComponent(epicFilter)}`)
          .then((r) => r.json()).then(setParentTasks).catch(() => {})
          .finally(() => setParentTaskLoading(false));
      } else {
        setEpicLoading(true);
        fetch(`/api/jira/epics?project=${encodeURIComponent(form.project)}&query=${encodeURIComponent(epicFilter)}`)
          .then((r) => r.json()).then(setEpics).catch(() => {})
          .finally(() => setEpicLoading(false));
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [form.project, form.issuetype, epicFilter]);

  useEffect(() => {
    if (!form.project) { setSprints([]); setSprintFilter(''); return; }
    const timer = setTimeout(() => {
      setSprintLoading(true);
      fetch(`/api/jira/sprints?project=${encodeURIComponent(form.project)}`)
        .then((r) => r.json()).then(setSprints).catch(() => {})
        .finally(() => setSprintLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [form.project]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (projectRef.current && !projectRef.current.contains(e.target as Node)) setShowProjectDropdown(false);
      if (userRef.current && !userRef.current.contains(e.target as Node)) setShowUserDropdown(false);
      if (epicRef.current && !epicRef.current.contains(e.target as Node)) setShowEpicDropdown(false);
      if (sprintRef.current && !sprintRef.current.contains(e.target as Node)) setShowSprintDropdown(false);
      if (issueTypeRef.current && !issueTypeRef.current.contains(e.target as Node)) setShowIssueTypeDropdown(false);
      if (priorityRef.current && !priorityRef.current.contains(e.target as Node)) setShowPriorityDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const closeAllDropdowns = () => {
    setShowProjectDropdown(false); setShowUserDropdown(false); setShowEpicDropdown(false);
    setShowSprintDropdown(false); setShowIssueTypeDropdown(false); setShowPriorityDropdown(false);
  };

  const handleCreate = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setSuccess(false);
    if (form.issuetype === 'Sub-task' && !form.parent) {
      setError('Vui lòng chọn Parent Task trước khi tạo Sub-task');
      return;
    }
    setLoading(true);
    try {
      const body: Record<string, unknown> = { project: form.project, summary: form.summary, issuetype: form.issuetype };
      if (form.description) body.description = form.description;
      if (form.priority) body.priority = form.priority;
      if (form.assignee) body.assignee = form.assignee;
      if (form.parent) body.parent = form.parent;
      if (form.labels.trim()) body.labels = form.labels.split(',').map((l) => l.trim());
      if (form.customFieldSprint) body.customFieldSprint = form.customFieldSprint;
      if (form.originalEstimate) body.originalEstimate = form.originalEstimate;
      if (form.remainingEstimate) body.remainingEstimate = form.remainingEstimate;
      if (form.startDate) body.startDate = form.startDate;
      if (form.dueDate) body.dueDate = form.dueDate;

      const res = await fetch('/api/jira/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `API error: ${res.status}`);
      setCreatedKey(data.key);
      setSuccess(true);
      setForm({ project: '', summary: '', description: '', issuetype: 'Task', priority: '', assignee: '', labels: '', parent: '', customFieldSprint: '', originalEstimate: '1d', remainingEstimate: '1d', startDate: todayMorning, dueDate: todayEvening });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setLoading(false);
    }
  }, [form, todayMorning, todayEvening]);

  const dropdownStyle: React.CSSProperties = {
    background: 'var(--dropdown-bg)',
    border: '1px solid var(--border)',
    backdropFilter: 'blur(18px) saturate(1.3)',
  };

  const filteredProjects = projects.filter((p) => p.name.toLowerCase().includes(projectFilter.toLowerCase()) || p.key.toLowerCase().includes(projectFilter.toLowerCase()));
  const filteredIssueTypes = issueTypeOptions.filter((t) => t.toLowerCase().includes(issueTypeFilter.toLowerCase()));
  const filteredPriorities = priorityOptions.filter((p) => p.toLowerCase().includes(priorityFilter.toLowerCase()));
  const filteredSprints = sprints.filter((s) => s.name.toLowerCase().includes(sprintFilter.toLowerCase()));
  const parentData = form.issuetype === 'Sub-task' ? parentTasks : epics;
  const filteredParent = parentData.filter((i) => i.key.toLowerCase().includes(epicFilter.toLowerCase()) || i.summary.toLowerCase().includes(epicFilter.toLowerCase()));
  const parentDisplay = form.parent ? (parentData.find((i) => i.key === form.parent)?.key || null) : null;
  const createdIssueUrl = createdKey && jiraBaseUrl ? `${jiraBaseUrl}/browse/${createdKey}` : null;

  // Shared dropdown trigger button style
  const triggerStyle = (hasValue: boolean, disabled = false): React.CSSProperties => ({
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    color: hasValue ? 'var(--text)' : 'var(--text-muted)',
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ background: c.backdropBlur, backdropFilter: 'blur(8px)' }}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl flex flex-col"
        style={{
          background: c.cardBg,
          WebkitBackdropFilter: 'blur(32px) saturate(1.6)',
          backdropFilter: 'blur(32px) saturate(1.6)',
          border: `1px solid ${c.border}`,
          boxShadow: isLight
            ? '0 16px 64px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.85)'
            : '0 16px 64px rgba(0,0,0,0.5), 0 8px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0" style={{ borderColor: c.borderRow, background: c.cardBg }}>
          <h2 className="text-base font-bold" style={{ color: c.textPrimary }}>{t('createTask.create')}</h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-sm" style={{ color: c.textMuted, background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(20,22,40,0.5)', cursor: 'pointer' }} title="Đóng (Esc)">✕</button>
        </div>

        {/* Scrollable body */}
        <form onSubmit={handleCreate} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

            {/* Summary */}
            <div>
              <FieldLabel label={t('createTask.issueTitleLabel')} c={c} />
              <input
                type="text" required value={form.summary}
                onChange={(e) => setForm({ ...form, summary: e.target.value })}
                placeholder={t('createTask.issueTitlePlaceholder')}
                className="input-field w-full px-3 py-2 text-sm"
              />
            </div>

            {/* Row 1: Project · Issue Type · Priority */}
            <div className="grid grid-cols-3 gap-4">
              {/* Project */}
              <div ref={projectRef} style={{ position: 'relative' }}>
                <FieldLabel label={t('createTask.projectLabel')} c={c} />
                <button type="button" onClick={(e) => { e.stopPropagation(); closeAllDropdowns(); setShowProjectDropdown(!showProjectDropdown); }}
                  className="input-field w-full px-3 py-2 text-sm flex items-center justify-between gap-1"
                  style={triggerStyle(!!form.project)}
                >
                  <span className="truncate">{form.project ? projects.find((p) => p.key === form.project)?.name : t('createTask.projectPlaceholder')}</span>
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--text-muted)' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                {showProjectDropdown && (
                  <div className="absolute top-full left-0 mt-1 w-full rounded-xl z-50 overflow-hidden" style={{ ...dropdownStyle, maxHeight: '200px', overflowY: 'auto', minWidth: '200px' }}>
                    <div className="sticky top-0 p-2 border-b" style={{ borderColor: 'var(--border)', background: 'var(--dropdown-bg)' }}>
                      <input autoFocus type="text" value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} placeholder={t('createTask.filterPlaceholder')} className="w-full px-2 py-1 text-sm" style={{ background: 'transparent', border: 'none', color: 'var(--text)', outline: 'none' }} />
                    </div>
                    {projectLoading && <div className="p-3 text-center text-sm" style={{ color: 'var(--text-muted)' }}>{t('jql.loading')}</div>}
                    {filteredProjects.map((p) => (
                      <button key={p.key} type="button" className="w-full px-3 py-2 text-left flex items-center justify-between gap-2"
                        style={{ color: form.project === p.key ? 'var(--accent)' : 'var(--text)', background: form.project === p.key ? 'var(--accent-bg)' : 'transparent', cursor: 'pointer' }}
                        onMouseEnter={(e) => { if (form.project !== p.key) e.currentTarget.style.background = 'var(--surface-hover)'; }}
                        onMouseLeave={(e) => { if (form.project !== p.key) e.currentTarget.style.background = 'transparent'; }}
                        onClick={() => { setForm({ ...form, project: p.key }); setShowProjectDropdown(false); setProjectFilter(''); }}
                      >
                        <span className="text-sm truncate">{p.name}</span>
                        <span className="text-xs font-mono flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{p.key}</span>
                      </button>
                    ))}
                    {!projectLoading && filteredProjects.length === 0 && <div className="p-3 text-center text-sm" style={{ color: 'var(--text-muted)' }}>{t('createTask.noProjectFound')}</div>}
                  </div>
                )}
              </div>

              {/* Issue Type */}
              <div ref={issueTypeRef} style={{ position: 'relative' }}>
                <FieldLabel label={t('createTask.issueTypeLabel')} c={c} />
                <button type="button" onClick={(e) => { e.stopPropagation(); closeAllDropdowns(); setShowIssueTypeDropdown(!showIssueTypeDropdown); }}
                  className="input-field w-full px-3 py-2 text-sm flex items-center justify-between gap-1"
                  style={triggerStyle(true)}
                >
                  <span className="truncate">{form.issuetype}</span>
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--text-muted)' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                {showIssueTypeDropdown && (
                  <div className="absolute top-full left-0 mt-1 w-full rounded-xl z-50 overflow-hidden" style={{ ...dropdownStyle, maxHeight: '200px', overflowY: 'auto' }}>
                    <div className="sticky top-0 p-2 border-b" style={{ borderColor: 'var(--border)', background: 'var(--dropdown-bg)' }}>
                      <input autoFocus type="text" value={issueTypeFilter} onChange={(e) => setIssueTypeFilter(e.target.value)} placeholder={t('createTask.issueTypeFilterPlaceholder')} className="w-full px-2 py-1 text-sm" style={{ background: 'transparent', border: 'none', color: 'var(--text)', outline: 'none' }} />
                    </div>
                    {filteredIssueTypes.map((type) => (
                      <button key={type} type="button" className="w-full px-3 py-2 text-left text-sm"
                        style={{ color: form.issuetype === type ? 'var(--accent)' : 'var(--text)', background: form.issuetype === type ? 'var(--accent-bg)' : 'transparent', cursor: 'pointer' }}
                        onMouseEnter={(e) => { if (form.issuetype !== type) e.currentTarget.style.background = 'var(--surface-hover)'; }}
                        onMouseLeave={(e) => { if (form.issuetype !== type) e.currentTarget.style.background = 'transparent'; }}
                        onClick={() => { setForm({ ...form, issuetype: type }); setShowIssueTypeDropdown(false); setIssueTypeFilter(''); }}
                      >{type}</button>
                    ))}
                  </div>
                )}
              </div>

              {/* Priority */}
              <div ref={priorityRef} style={{ position: 'relative' }}>
                <FieldLabel label={t('createTask.priorityLabel')} c={c} />
                <button type="button" onClick={(e) => { e.stopPropagation(); closeAllDropdowns(); setShowPriorityDropdown(!showPriorityDropdown); }}
                  className="input-field w-full px-3 py-2 text-sm flex items-center justify-between gap-1"
                  style={triggerStyle(!!form.priority)}
                >
                  <span className="truncate">{form.priority || t('createTask.priorityPlaceholder')}</span>
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--text-muted)' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                {showPriorityDropdown && (
                  <div className="absolute top-full left-0 mt-1 w-full rounded-xl z-50 overflow-hidden" style={{ ...dropdownStyle, maxHeight: '200px', overflowY: 'auto' }}>
                    <div className="sticky top-0 p-2 border-b" style={{ borderColor: 'var(--border)', background: 'var(--dropdown-bg)' }}>
                      <input autoFocus type="text" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} placeholder={t('createTask.priorityFilterPlaceholder')} className="w-full px-2 py-1 text-sm" style={{ background: 'transparent', border: 'none', color: 'var(--text)', outline: 'none' }} />
                    </div>
                    <button type="button" className="w-full px-3 py-2 text-left text-sm"
                      style={{ color: !form.priority ? 'var(--accent)' : 'var(--text)', background: !form.priority ? 'var(--accent-bg)' : 'transparent', cursor: 'pointer' }}
                      onMouseEnter={(e) => { if (form.priority) e.currentTarget.style.background = 'var(--surface-hover)'; }}
                      onMouseLeave={(e) => { if (form.priority) e.currentTarget.style.background = 'transparent'; }}
                      onClick={() => { setForm({ ...form, priority: '' }); setShowPriorityDropdown(false); setPriorityFilter(''); }}
                    >{t('createTask.priorityNone')}</button>
                    {filteredPriorities.map((p) => (
                      <button key={p} type="button" className="w-full px-3 py-2 text-left text-sm"
                        style={{ color: form.priority === p ? 'var(--accent)' : 'var(--text)', background: form.priority === p ? 'var(--accent-bg)' : 'transparent', cursor: 'pointer' }}
                        onMouseEnter={(e) => { if (form.priority !== p) e.currentTarget.style.background = 'var(--surface-hover)'; }}
                        onMouseLeave={(e) => { if (form.priority !== p) e.currentTarget.style.background = 'transparent'; }}
                        onClick={() => { setForm({ ...form, priority: p }); setShowPriorityDropdown(false); setPriorityFilter(''); }}
                      >{p}</button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Row 2: Assignee · Sprint · Parent/Epic */}
            <div className="grid grid-cols-3 gap-4">
              {/* Assignee */}
              <div ref={userRef} style={{ position: 'relative' }}>
                <FieldLabel label={t('createTask.assigneeLabel')} c={c} />
                <div style={{ position: 'relative' }}>
                  <input type="text" value={form.assignee}
                    onChange={(e) => { setForm({ ...form, assignee: e.target.value }); setShowUserDropdown(true); }}
                    onFocus={() => { if (form.assignee) setShowUserDropdown(true); }}
                    placeholder={t('createTask.assigneePlaceholder')}
                    className="input-field w-full px-3 py-2 text-sm"
                    style={{ paddingRight: userLoading ? '32px' : undefined }}
                  />
                  {userLoading && (
                    <svg className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 animate-spin" style={{ color: 'var(--text-muted)' }} viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  )}
                  {showUserDropdown && users.length > 0 && (
                    <div className="absolute top-full left-0 mt-1 w-full rounded-xl z-50 overflow-hidden" style={{ ...dropdownStyle, maxHeight: '160px', overflowY: 'auto' }}>
                      {users.map((u) => (
                        <button key={u.name} type="button" className="w-full px-3 py-2 text-left" style={{ color: 'var(--text)', cursor: 'pointer' }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-hover)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          onClick={() => { setForm({ ...form, assignee: u.name }); setShowUserDropdown(false); }}
                        >
                          <span className="text-sm">{u.displayName}</span>
                          <span className="text-xs ml-2" style={{ color: 'var(--text-muted)' }}>@{u.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Sprint */}
              <div ref={sprintRef} style={{ position: 'relative' }}>
                <FieldLabel label={t('createTask.sprintLabel')} c={c} />
                <button type="button"
                  onClick={(e) => { e.stopPropagation(); if (!form.project) return; closeAllDropdowns(); setShowSprintDropdown(!showSprintDropdown); }}
                  disabled={!form.project}
                  className="input-field w-full px-3 py-2 text-sm flex items-center justify-between gap-1"
                  style={triggerStyle(!!form.customFieldSprint, !form.project)}
                >
                  <span className="truncate">{form.customFieldSprint ? sprints.find((s) => String(s.id) === form.customFieldSprint)?.name : t('createTask.sprintPlaceholder')}</span>
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--text-muted)' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                {showSprintDropdown && form.project && (
                  <div className="absolute top-full left-0 mt-1 w-full rounded-xl z-50 overflow-hidden" style={{ ...dropdownStyle, maxHeight: '200px', overflowY: 'auto', minWidth: '200px' }}>
                    <div className="sticky top-0 p-2 border-b" style={{ borderColor: 'var(--border)', background: 'var(--dropdown-bg)' }}>
                      <input autoFocus type="text" value={sprintFilter} onChange={(e) => setSprintFilter(e.target.value)} placeholder={t('createTask.sprintFilterPlaceholder')} className="w-full px-2 py-1 text-sm" style={{ background: 'transparent', border: 'none', color: 'var(--text)', outline: 'none' }} />
                    </div>
                    {sprintLoading && <div className="p-3 text-center text-sm" style={{ color: 'var(--text-muted)' }}>{t('jql.loading')}</div>}
                    {filteredSprints.map((s) => (
                      <button key={s.id} type="button" className="w-full px-3 py-2 text-left flex items-center justify-between gap-2"
                        style={{ color: form.customFieldSprint === String(s.id) ? 'var(--accent)' : 'var(--text)', background: form.customFieldSprint === String(s.id) ? 'var(--accent-bg)' : 'transparent', cursor: 'pointer' }}
                        onMouseEnter={(e) => { if (form.customFieldSprint !== String(s.id)) e.currentTarget.style.background = 'var(--surface-hover)'; }}
                        onMouseLeave={(e) => { if (form.customFieldSprint !== String(s.id)) e.currentTarget.style.background = 'transparent'; }}
                        onClick={() => { setForm({ ...form, customFieldSprint: String(s.id) }); setShowSprintDropdown(false); setSprintFilter(''); }}
                      >
                        <span className="text-sm truncate">{s.name}</span>
                        <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{s.state === 'active' ? t('createTask.sprintActive') : t('createTask.sprintFuture')}</span>
                      </button>
                    ))}
                    {!sprintLoading && filteredSprints.length === 0 && <div className="p-3 text-center text-sm" style={{ color: 'var(--text-muted)' }}>{t('createTask.noSprintFound')}</div>}
                  </div>
                )}
              </div>

              {/* Parent / Epic */}
              <div ref={epicRef} style={{ position: 'relative' }}>
                <FieldLabel label={form.issuetype === 'Sub-task' ? t('createTask.parentLabel') : t('createTask.parentEpicLabel')} c={c} />
                <button type="button"
                  onClick={(e) => { e.stopPropagation(); if (!form.project) return; closeAllDropdowns(); setShowEpicDropdown(!showEpicDropdown); }}
                  disabled={!form.project}
                  className="input-field w-full px-3 py-2 text-sm flex items-center justify-between gap-1"
                  style={triggerStyle(!!parentDisplay, !form.project)}
                >
                  <span className="truncate">{parentDisplay || (form.issuetype === 'Sub-task' ? t('createTask.parentTaskPlaceholder') : t('createTask.parentEpicPlaceholder'))}</span>
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--text-muted)' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                {showEpicDropdown && form.project && (
                  <div className="absolute top-full left-0 mt-1 w-full rounded-xl z-50 overflow-hidden" style={{ ...dropdownStyle, maxHeight: '200px', overflowY: 'auto', minWidth: '200px' }}>
                    <div className="sticky top-0 p-2 border-b" style={{ borderColor: 'var(--border)', background: 'var(--dropdown-bg)' }}>
                      <input autoFocus type="text" value={epicFilter} onChange={(e) => setEpicFilter(e.target.value)} placeholder={form.issuetype === 'Sub-task' ? t('createTask.filterTaskPlaceholder') : t('createTask.filterEpicPlaceholder')} className="w-full px-2 py-1 text-sm" style={{ background: 'transparent', border: 'none', color: 'var(--text)', outline: 'none' }} />
                    </div>
                    {(parentTaskLoading || epicLoading) && <div className="p-3 text-center text-sm" style={{ color: 'var(--text-muted)' }}>{t('jql.loading')}</div>}
                    {filteredParent.map((item) => (
                      <button key={item.key} type="button" className="w-full px-3 py-2 text-left flex items-center justify-between gap-2"
                        style={{ color: form.parent === item.key ? 'var(--accent)' : 'var(--text)', background: form.parent === item.key ? 'var(--accent-bg)' : 'transparent', cursor: 'pointer' }}
                        onMouseEnter={(e) => { if (form.parent !== item.key) e.currentTarget.style.background = 'var(--surface-hover)'; }}
                        onMouseLeave={(e) => { if (form.parent !== item.key) e.currentTarget.style.background = 'transparent'; }}
                        onClick={() => { setForm({ ...form, parent: item.key }); setShowEpicDropdown(false); setEpicFilter(''); }}
                      >
                        <span className="text-sm truncate">{form.issuetype === 'Sub-task' ? item.key : item.summary}</span>
                        <span className="text-xs font-mono flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{item.key}</span>
                      </button>
                    ))}
                    {!parentTaskLoading && !epicLoading && filteredParent.length === 0 && <div className="p-3 text-center text-sm" style={{ color: 'var(--text-muted)' }}>{t('createTask.noFound')}</div>}
                  </div>
                )}
              </div>
            </div>

            {/* Row 3: Original Estimate · Remaining Estimate · Labels */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <FieldLabel label={t('createTask.originalEstimateLabel')} c={c} />
                <div style={{ position: 'relative' }}>
                  <input type="text" value={form.originalEstimate} onChange={(e) => setForm({ ...form, originalEstimate: e.target.value })} placeholder={t('createTask.originalEstimatePlaceholder')} className="input-field w-full px-3 py-2 text-sm" style={{ paddingRight: '40px' }} />
                  <button type="button" onClick={() => setForm({ ...form, remainingEstimate: form.originalEstimate })} title={t('createTask.copyToRemaining')} className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded" style={{ background: 'var(--surface-light)', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                  </button>
                </div>
              </div>
              <div>
                <FieldLabel label={t('createTask.remainingEstimateLabel')} c={c} />
                <input type="text" value={form.remainingEstimate} onChange={(e) => setForm({ ...form, remainingEstimate: e.target.value })} placeholder={t('createTask.remainingEstimatePlaceholder')} className="input-field w-full px-3 py-2 text-sm" />
              </div>
              <div>
                <FieldLabel label={t('createTask.labelsLabel')} c={c} />
                <input type="text" value={form.labels} onChange={(e) => setForm({ ...form, labels: e.target.value })} placeholder={t('createTask.labelsPlaceholder')} className="input-field w-full px-3 py-2 text-sm" />
              </div>
            </div>

            {/* Row 4: Start Date · Due Date */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel label={t('createTask.startDateLabel')} c={c} />
                <input type="datetime-local" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="input-field w-full px-3 py-2 text-sm" />
              </div>
              <div>
                <FieldLabel label={t('createTask.dueDateLabel')} c={c} />
                <input type="datetime-local" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="input-field w-full px-3 py-2 text-sm" />
              </div>
            </div>

            {/* Description */}
            <div>
              <FieldLabel label={t('createTask.descriptionLabel')} c={c} />
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder={t('createTask.descriptionPlaceholder')}
                className="input-field w-full px-3 py-2 text-sm resize-none"
                style={{
                  minHeight: '120px',
                  background: c.cardBgInner,
                  border: `1px solid ${c.border}`,
                  color: c.textSecondary,
                }}
              />
            </div>

            {/* Success / Error */}
            {success && (
              <div className="rounded-xl p-3" style={{ background: 'var(--success-bg)' }}>
                <p className="text-xs font-medium" style={{ color: 'var(--success)' }}>
                  Task created!{' '}
                  {createdIssueUrl
                    ? <a href={createdIssueUrl} target="_blank" rel="noopener noreferrer" className="underline font-mono" style={{ color: 'var(--success)' }}>{createdKey}</a>
                    : <span className="font-mono">{createdKey}</span>
                  }
                </p>
              </div>
            )}
            {error && (
              <div className="rounded-xl p-3" style={{ background: 'var(--danger-bg)' }}>
                <p className="text-xs" style={{ color: 'var(--danger)' }}>{error}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t shrink-0" style={{ borderColor: c.borderRow }}>
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-xl"
              style={{ color: 'var(--text-dim)', background: 'transparent', border: '1px solid var(--border)', cursor: 'pointer' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              {isLight ? 'Cancel' : 'Hủy'}
            </button>
            <button type="submit" disabled={loading} className="btn-primary px-6 py-2 text-sm">
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {t('createTask.creating')}
                </span>
              ) : t('createTask.create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
