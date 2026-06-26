'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useLanguage } from '@/lib/i18n';

interface Project {
  key: string;
  name: string;
}

interface User {
  name: string;
  displayName: string;
}

interface Epic {
  key: string;
  summary: string;
}

interface TaskOption {
  key: string;
  summary: string;
  status: string;
}

interface Component {
  id: string;
  name: string;
}

interface Sprint {
  id: number;
  name: string;
  state: string;
}

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
  customFieldEpic: string;
  customFieldStoryPoints: string;
  originalEstimate: string;
  remainingEstimate: string;
  components: string[];
  startDate: string;
  dueDate: string;
}

const issueTypeOptions = ['Task', 'Story', 'Sub-task', 'Bug', 'Epic'] as const;
const priorityOptions = ['Highest', 'High', 'Medium', 'Low', 'Lowest'] as const;
const jiraBaseUrl = (process.env.NEXT_PUBLIC_JIRA_BASE_URL || '').replace(/\/+$/, '');

export default function CreateTaskPage() {
  const { t } = useLanguage();
  const today = new Date();
  const todayYear = today.getFullYear();
  const todayMonth = String(today.getMonth() + 1).padStart(2, '0');
  const todayDay = String(today.getDate()).padStart(2, '0');
  const todayStr = `${todayYear}-${todayMonth}-${todayDay}`;
  const todayMorning = `${todayStr}T08:00`;
  const todayEvening = `${todayStr}T17:00`;

  const [form, setForm] = useState<TaskForm>({
    project: '',
    summary: '',
    description: '',
    issuetype: 'Task',
    priority: '',
    assignee: '',
    labels: '',
    parent: '',
    customFieldSprint: '',
    customFieldEpic: '',
    customFieldStoryPoints: '',
    components: [],
    startDate: todayMorning,
    dueDate: todayEvening,
    originalEstimate: '1d',
    remainingEstimate: '1d',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectLoading, setProjectLoading] = useState(false);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [userLoading, setUserLoading] = useState(false);
  const [epics, setEpics] = useState<Epic[]>([]);
  const [epicLoading, setEpicLoading] = useState(false);
  const [epicError, setEpicError] = useState<string | null>(null);
  const [parentTasks, setParentTasks] = useState<TaskOption[]>([]);
  const [parentTaskLoading, setParentTaskLoading] = useState(false);
  const [parentTaskError, setParentTaskError] = useState<string | null>(null);
  const [components, setComponents] = useState<Component[]>([]);
  const [componentLoading, setComponentLoading] = useState(false);
  const [componentError, setComponentError] = useState<string | null>(null);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [sprintLoading, setSprintLoading] = useState(false);
  const [sprintError, setSprintError] = useState<string | null>(null);
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showEpicDropdown, setShowEpicDropdown] = useState(false);
  const [showComponentDropdown, setShowComponentDropdown] = useState(false);
  const [showSprintDropdown, setShowSprintDropdown] = useState(false);
  const [showIssueTypeDropdown, setShowIssueTypeDropdown] = useState(false);
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);
  const [projectFilter, setProjectFilter] = useState('');
  const [epicFilter, setEpicFilter] = useState('');
  const [componentFilter, setComponentFilter] = useState('');
  const [sprintFilter, setSprintFilter] = useState('');
  const [issueTypeFilter, setIssueTypeFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const projectRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);
  const epicRef = useRef<HTMLDivElement>(null);
  const componentRef = useRef<HTMLDivElement>(null);
  const sprintRef = useRef<HTMLDivElement>(null);
  const issueTypeRef = useRef<HTMLDivElement>(null);
  const priorityRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchProjects = async () => {
      setProjectLoading(true);
      try {
        const res = await fetch('/api/jira/projects');
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const data = await res.json();
        setProjects(data);
      } catch (err) {
        setProjectError(err instanceof Error ? err.message : 'Failed to fetch projects');
      } finally {
        setProjectLoading(false);
      }
    };
    fetchProjects();
  }, []);

  useEffect(() => {
    if (!form.assignee || form.assignee.length < 1) {
      setUsers([]);
      return;
    }
    const fetchUsers = async () => {
      setUserLoading(true);
      try {
        const res = await fetch(`/api/jira/users?query=${encodeURIComponent(form.assignee)}`);
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const data = await res.json();
        setUsers(data);
      } catch (err) {
        // Ignore user search errors silently
      } finally {
        setUserLoading(false);
      }
    };
    const timer = setTimeout(fetchUsers, 300);
    return () => clearTimeout(timer);
  }, [form.assignee]);

  useEffect(() => {
    if (!form.project) {
      setEpics([]);
      setParentTasks([]);
      setEpicFilter('');
      setComponentFilter('');
      setSprints([]);
      setSprintFilter('');
      return;
    }
    const fetchEpics = async () => {
      if (form.issuetype === 'Sub-task') {
        setParentTaskLoading(true);
        setParentTaskError(null);
        try {
          const res = await fetch(`/api/jira/tasks?project=${encodeURIComponent(form.project)}&query=${encodeURIComponent(epicFilter)}`);
          if (!res.ok) throw new Error(`API error: ${res.status}`);
          const data = await res.json();
          setParentTasks(data);
        } catch (err) {
          setParentTaskError(err instanceof Error ? err.message : 'Failed to fetch tasks');
        } finally {
          setParentTaskLoading(false);
        }
      } else {
        setEpicLoading(true);
        setEpicError(null);
        try {
          const res = await fetch(`/api/jira/epics?project=${encodeURIComponent(form.project)}&query=${encodeURIComponent(epicFilter)}`);
          if (!res.ok) throw new Error(`API error: ${res.status}`);
          const data = await res.json();
          setEpics(data);
        } catch (err) {
          setEpicError(err instanceof Error ? err.message : 'Failed to fetch epics');
        } finally {
          setEpicLoading(false);
        }
      }
    };
    const timer = setTimeout(fetchEpics, 300);
    return () => clearTimeout(timer);
  }, [form.project, form.issuetype, epicFilter]);

  useEffect(() => {
    if (!form.project) {
      setComponents([]);
      setComponentFilter('');
      return;
    }
    const fetchComponents = async () => {
      setComponentLoading(true);
      setComponentError(null);
      try {
        const res = await fetch(`/api/jira/components?project=${encodeURIComponent(form.project)}`);
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const data = await res.json();
        setComponents(data);
      } catch (err) {
        setComponentError(err instanceof Error ? err.message : 'Failed to fetch components');
      } finally {
        setComponentLoading(false);
      }
    };
    const timer = setTimeout(fetchComponents, 300);
    return () => clearTimeout(timer);
  }, [form.project]);

  useEffect(() => {
    if (!form.project) {
      setSprints([]);
      setSprintFilter('');
      return;
    }
    const fetchSprints = async () => {
      setSprintLoading(true);
      setSprintError(null);
      try {
        const res = await fetch(`/api/jira/sprints?project=${encodeURIComponent(form.project)}`);
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const data = await res.json();
        setSprints(data);
      } catch (err) {
        setSprintError(err instanceof Error ? err.message : 'Failed to fetch sprints');
      } finally {
        setSprintLoading(false);
      }
    };
    const timer = setTimeout(fetchSprints, 300);
    return () => clearTimeout(timer);
  }, [form.project]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (projectRef.current && !projectRef.current.contains(e.target as Node)) {
        setShowProjectDropdown(false);
      }
      if (userRef.current && !userRef.current.contains(e.target as Node)) {
        setShowUserDropdown(false);
      }
      if (epicRef.current && !epicRef.current.contains(e.target as Node)) {
        setShowEpicDropdown(false);
      }
      if (componentRef.current && !componentRef.current.contains(e.target as Node)) {
        setShowComponentDropdown(false);
      }
      if (sprintRef.current && !sprintRef.current.contains(e.target as Node)) {
        setShowSprintDropdown(false);
      }
      if (issueTypeRef.current && !issueTypeRef.current.contains(e.target as Node)) {
        setShowIssueTypeDropdown(false);
      }
      if (priorityRef.current && !priorityRef.current.contains(e.target as Node)) {
        setShowPriorityDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCreate = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (form.issuetype === 'Sub-task' && !form.parent) {
      setError('Vui lòng chọn Parent Task trước khi tạo Sub-task');
      return;
    }

    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        project: form.project,
        summary: form.summary,
        issuetype: form.issuetype,
      };
      if (form.description) body.description = form.description;
      if (form.priority) body.priority = form.priority;
      if (form.assignee) body.assignee = form.assignee;
      if (form.parent) body.parent = form.parent;
      if (form.labels.trim()) body.labels = form.labels.split(',').map((l) => l.trim());
      if (form.customFieldSprint) body.customFieldSprint = form.customFieldSprint;
      if (form.customFieldEpic) body.customFieldEpic = form.customFieldEpic;
      if (form.customFieldStoryPoints) body.customFieldStoryPoints = parseInt(form.customFieldStoryPoints);
      if (form.originalEstimate) body.originalEstimate = form.originalEstimate;
      if (form.remainingEstimate) body.remainingEstimate = form.remainingEstimate;
      if (form.components.length > 0) body.components = form.components;
      if (form.startDate) body.startDate = form.startDate;
      if (form.dueDate) body.dueDate = form.dueDate;

      const res = await fetch('/api/jira/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `API error: ${res.status}`);
      setCreatedKey(data.key);
      setSuccess(true);
      setForm({
        project: '',
        summary: '',
        description: '',
        issuetype: 'Task',
        priority: '',
        assignee: '',
        labels: '',
        parent: '',
        customFieldSprint: '',
        customFieldEpic: '',
        customFieldStoryPoints: '',
        components: [],
        startDate: todayMorning,
        dueDate: todayEvening,
        originalEstimate: '1d',
        remainingEstimate: '1d',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setLoading(false);
    }
  }, [form, todayMorning, todayEvening]);

  const toggleComponent = (id: string, name: string) => {
    setForm((prev) => ({
      ...prev,
      components: prev.components.includes(name)
        ? prev.components.filter((c) => c !== name)
        : [...prev.components, name],
    }));
  };

  const dropdownStyle: React.CSSProperties = {
    background: 'var(--dropdown-bg)',
    border: '1px solid var(--border)',
    backdropFilter: 'blur(18px) saturate(1.3)',
  };

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(projectFilter.toLowerCase()) ||
    p.key.toLowerCase().includes(projectFilter.toLowerCase())
  );

  const filteredEpics = epics.filter((e) =>
    e.key.toLowerCase().includes(epicFilter.toLowerCase()) ||
    e.summary.toLowerCase().includes(epicFilter.toLowerCase())
  );

  const filteredParentTasks = parentTasks.filter((t) =>
    t.key.toLowerCase().includes(epicFilter.toLowerCase()) ||
    t.summary.toLowerCase().includes(epicFilter.toLowerCase())
  );

  const filteredComponents = components.filter((c) =>
    c.name.toLowerCase().includes(componentFilter.toLowerCase())
  );

  const filteredSprints = sprints.filter((s) =>
    s.name.toLowerCase().includes(sprintFilter.toLowerCase())
  );

  const filteredIssueTypes = issueTypeOptions.filter((type) =>
    type.toLowerCase().includes(issueTypeFilter.toLowerCase())
  );

  const filteredPriorities = priorityOptions.filter((p) =>
    p.toLowerCase().includes(priorityFilter.toLowerCase())
  );

  const parentLabelKey = form.issuetype === 'Sub-task' ? 'createTask.parentLabel' : 'createTask.parentEpicLabel';
  const parentPlaceholderKey = form.issuetype === 'Sub-task' ? 'createTask.parentTaskPlaceholder' : 'createTask.parentEpicPlaceholder';
  const parentData = form.issuetype === 'Sub-task' ? parentTasks : epics;
  const parentDisplay = form.parent
    ? (parentData.find((e) => e.key === form.parent)?.key || null)
    : null;
  const epicPlaceholder = form.issuetype === 'Sub-task' ? 'createTask.filterTaskPlaceholder' : 'createTask.filterEpicPlaceholder';
  const createdIssueUrl = createdKey && jiraBaseUrl ? `${jiraBaseUrl}/browse/${createdKey}` : null;

  return (
    <form onSubmit={handleCreate} className="flex flex-1 p-4 gap-4" style={{ height: 'calc(100vh - 56px)' }}>
      {/* Left Column - 3/12 Filters */}
      <div className="flex-shrink-0 overflow-y-auto" style={{ width: '25%', borderRight: '1px solid var(--border)' }}>
        <div className="sticky top-0 p-4 space-y-4" style={{ background: 'var(--surface)', zIndex: 1 }}>
          <h2 className="text-sm font-bold" style={{ color: 'var(--text)' }}>{t('createTask.fields')}</h2>

          {/* Project */}
          <div ref={projectRef} style={{ position: 'relative' }}>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-dim)' }}>{t('createTask.projectLabel')}</label>
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowProjectDropdown(!showProjectDropdown);
                  setShowUserDropdown(false);
                  setShowEpicDropdown(false);
                  setShowComponentDropdown(false);
                  setShowSprintDropdown(false);
                  setShowIssueTypeDropdown(false);
                  setShowPriorityDropdown(false);
                }}
                className="input-field w-full px-3 py-2 text-sm flex items-center justify-between"
                style={{ cursor: 'pointer' }}
              >
                <span style={{ color: form.project ? 'var(--text)' : 'var(--text-muted)' }}>
                  {form.project ? projects.find((p) => p.key === form.project)?.name : t('createTask.projectPlaceholder')}
                </span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--text-muted)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showProjectDropdown && (
                <div className="absolute top-full left-0 mt-1 w-full rounded-xl z-50 overflow-hidden" style={{ ...dropdownStyle, maxHeight: '240px', overflowY: 'auto' }}>
                  <div className="sticky top-0 p-2 border-b" style={{ borderColor: 'var(--border)', background: 'var(--dropdown-bg)' }}>
                    <input
                      type="text"
                      value={projectFilter}
                      onChange={(e) => setProjectFilter(e.target.value)}
                      placeholder={t('createTask.filterPlaceholder')}
                      className="w-full px-3 py-1.5 text-sm"
                      style={{ background: 'transparent', border: 'none', color: 'var(--text)', outline: 'none' }}
                    />
                  </div>
                  {projectLoading && <div className="p-3 text-center text-sm" style={{ color: 'var(--text-muted)' }}>{t('jql.loading')}</div>}
                  {projectError && <div className="p-3 text-center text-sm" style={{ color: 'var(--danger)' }}>{projectError}</div>}
                  {!projectLoading && !projectError && filteredProjects.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      className="w-full px-3 py-2 text-left flex items-center justify-between gap-2 transition-all duration-150"
                      style={{
                        color: form.project === p.key ? 'var(--accent)' : 'var(--text)',
                        background: form.project === p.key ? 'var(--accent-bg)' : 'transparent',
                        fontWeight: form.project === p.key ? 500 : 400,
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => { if (form.project !== p.key) e.currentTarget.style.background = 'var(--surface-hover)'; }}
                      onMouseLeave={(e) => { if (form.project !== p.key) e.currentTarget.style.background = 'transparent'; }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setForm({ ...form, project: p.key });
                        setShowProjectDropdown(false);
                        setProjectFilter('');
                      }}
                    >
                      <span className="text-sm truncate flex-1">{p.name}</span>
                      <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{p.key}</span>
                    </button>
                  ))}
                  {!projectLoading && !projectError && filteredProjects.length === 0 && (
                    <div className="p-3 text-center text-sm" style={{ color: 'var(--text-muted)' }}>{t('createTask.noProjectFound')}</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Issue Type */}
          <div ref={issueTypeRef} style={{ position: 'relative' }}>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-dim)' }}>{t('createTask.issueTypeLabel')}</label>
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowIssueTypeDropdown(!showIssueTypeDropdown);
                  setShowProjectDropdown(false);
                  setShowUserDropdown(false);
                  setShowEpicDropdown(false);
                  setShowComponentDropdown(false);
                  setShowSprintDropdown(false);
                  setShowPriorityDropdown(false);
                }}
                className="input-field w-full px-3 py-2 text-sm flex items-center justify-between"
                style={{ cursor: 'pointer' }}
              >
                <span style={{ color: form.issuetype ? 'var(--text)' : 'var(--text-muted)' }}>
                  {form.issuetype || t('createTask.issueTypePlaceholder')}
                </span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--text-muted)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showIssueTypeDropdown && (
                <div className="absolute top-full left-0 mt-1 w-full rounded-xl z-50 overflow-hidden" style={{ ...dropdownStyle, maxHeight: '240px', overflowY: 'auto' }}>
                  <div className="sticky top-0 p-2 border-b" style={{ borderColor: 'var(--border)', background: 'var(--dropdown-bg)' }}>
                    <input
                      type="text"
                      value={issueTypeFilter}
                      onChange={(e) => setIssueTypeFilter(e.target.value)}
                      placeholder={t('createTask.issueTypeFilterPlaceholder')}
                      className="w-full px-3 py-1.5 text-sm"
                      style={{ background: 'transparent', border: 'none', color: 'var(--text)', outline: 'none' }}
                    />
                  </div>
                  {filteredIssueTypes.map((type) => (
                    <button
                      key={type}
                      type="button"
                      className="w-full px-3 py-2 text-left transition-all duration-150"
                      style={{
                        color: form.issuetype === type ? 'var(--accent)' : 'var(--text)',
                        background: form.issuetype === type ? 'var(--accent-bg)' : 'transparent',
                        fontWeight: form.issuetype === type ? 500 : 400,
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => { if (form.issuetype !== type) e.currentTarget.style.background = 'var(--surface-hover)'; }}
                      onMouseLeave={(e) => { if (form.issuetype !== type) e.currentTarget.style.background = 'transparent'; }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setForm({ ...form, issuetype: type });
                        setShowIssueTypeDropdown(false);
                        setIssueTypeFilter('');
                      }}
                    >
                      <span className="text-sm">{type}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Priority */}
          <div ref={priorityRef} style={{ position: 'relative' }}>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-dim)' }}>{t('createTask.priorityLabel')}</label>
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowPriorityDropdown(!showPriorityDropdown);
                  setShowProjectDropdown(false);
                  setShowUserDropdown(false);
                  setShowEpicDropdown(false);
                  setShowComponentDropdown(false);
                  setShowSprintDropdown(false);
                  setShowIssueTypeDropdown(false);
                }}
                className="input-field w-full px-3 py-2 text-sm flex items-center justify-between"
                style={{ cursor: 'pointer' }}
              >
                <span style={{ color: form.priority ? 'var(--text)' : 'var(--text-muted)' }}>
                  {form.priority || t('createTask.priorityPlaceholder')}
                </span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--text-muted)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showPriorityDropdown && (
                <div className="absolute top-full left-0 mt-1 w-full rounded-xl z-50 overflow-hidden" style={{ ...dropdownStyle, maxHeight: '240px', overflowY: 'auto' }}>
                  <div className="sticky top-0 p-2 border-b" style={{ borderColor: 'var(--border)', background: 'var(--dropdown-bg)' }}>
                    <input
                      type="text"
                      value={priorityFilter}
                      onChange={(e) => setPriorityFilter(e.target.value)}
                      placeholder={t('createTask.priorityFilterPlaceholder')}
                      className="w-full px-3 py-1.5 text-sm"
                      style={{ background: 'transparent', border: 'none', color: 'var(--text)', outline: 'none' }}
                    />
                  </div>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left transition-all duration-150"
                    style={{
                      color: !form.priority ? 'var(--accent)' : 'var(--text)',
                      background: !form.priority ? 'var(--accent-bg)' : 'transparent',
                      fontWeight: !form.priority ? 500 : 400,
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => { if (form.priority) e.currentTarget.style.background = 'var(--surface-hover)'; }}
                    onMouseLeave={(e) => { if (form.priority) e.currentTarget.style.background = 'transparent'; }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setForm({ ...form, priority: '' });
                      setShowPriorityDropdown(false);
                      setPriorityFilter('');
                    }}
                  >
                    <span className="text-sm">{t('createTask.priorityNone')}</span>
                  </button>
                  {filteredPriorities.map((p) => (
                    <button
                      key={p}
                      type="button"
                      className="w-full px-3 py-2 text-left transition-all duration-150"
                      style={{
                        color: form.priority === p ? 'var(--accent)' : 'var(--text)',
                        background: form.priority === p ? 'var(--accent-bg)' : 'transparent',
                        fontWeight: form.priority === p ? 500 : 400,
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => { if (form.priority !== p) e.currentTarget.style.background = 'var(--surface-hover)'; }}
                      onMouseLeave={(e) => { if (form.priority !== p) e.currentTarget.style.background = 'transparent'; }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setForm({ ...form, priority: p });
                        setShowPriorityDropdown(false);
                        setPriorityFilter('');
                      }}
                    >
                      <span className="text-sm">{p}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Parent */}
          <div ref={epicRef} style={{ position: 'relative' }}>
            <label className="block text-xs font-medium mb-1" style={{ color: form.project ? 'var(--text-dim)' : 'var(--text-muted)' }}>{t(parentLabelKey)}</label>
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!form.project) return;
                  setShowEpicDropdown(!showEpicDropdown);
                  setShowProjectDropdown(false);
                  setShowUserDropdown(false);
                  setShowComponentDropdown(false);
                  setShowSprintDropdown(false);
                  setShowIssueTypeDropdown(false);
                  setShowPriorityDropdown(false);
                }}
                disabled={!form.project}
                className="input-field w-full px-3 py-2 text-sm flex items-center justify-between"
                style={{
                  cursor: form.project ? 'pointer' : 'not-allowed',
                  opacity: form.project ? 1 : 0.5,
                  pointerEvents: form.project ? 'auto' : 'none',
                }}
              >
                <span style={{ color: parentDisplay ? 'var(--text)' : 'var(--text-muted)' }}>
                  {parentDisplay || t(parentPlaceholderKey)}
                </span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--text-muted)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showEpicDropdown && form.project && (
                <div className="absolute top-full left-0 mt-1 w-full rounded-xl z-50 overflow-hidden" style={{ ...dropdownStyle, maxHeight: '240px', overflowY: 'auto' }}>
                  <div className="sticky top-0 p-2 border-b" style={{ borderColor: 'var(--border)', background: 'var(--dropdown-bg)' }}>
                    <input
                      type="text"
                      value={epicFilter}
                      onChange={(e) => setEpicFilter(e.target.value)}
                      placeholder={t(epicPlaceholder)}
                      className="w-full px-3 py-1.5 text-sm"
                      style={{ background: 'transparent', border: 'none', color: 'var(--text)', outline: 'none' }}
                    />
                  </div>
                  {parentTaskLoading && <div className="p-3 text-center text-sm" style={{ color: 'var(--text-muted)' }}>{t('jql.loading')}</div>}
                  {parentTaskError && <div className="p-3 text-center text-sm" style={{ color: 'var(--danger)' }}>{parentTaskError}</div>}
                  {!parentTaskLoading && !parentTaskError && (form.issuetype === 'Sub-task' ? filteredParentTasks : filteredEpics).map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      className="w-full px-3 py-2 text-left flex items-center justify-between gap-2 transition-all duration-150"
                      style={{
                        color: form.parent === item.key ? 'var(--accent)' : 'var(--text)',
                        background: form.parent === item.key ? 'var(--accent-bg)' : 'transparent',
                        fontWeight: form.parent === item.key ? 500 : 400,
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => { if (form.parent !== item.key) e.currentTarget.style.background = 'var(--surface-hover)'; }}
                      onMouseLeave={(e) => { if (form.parent !== item.key) e.currentTarget.style.background = 'transparent'; }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setForm({ ...form, parent: item.key });
                        setShowEpicDropdown(false);
                        setEpicFilter('');
                      }}
                    >
                      <span className="text-sm truncate flex-1">{form.issuetype === 'Sub-task' ? item.key : item.summary}</span>
                      <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{item.key}</span>
                    </button>
                  ))}
                  {!parentTaskLoading && !parentTaskError && !epicLoading && !epicError && (form.issuetype === 'Sub-task' ? filteredParentTasks : filteredEpics).length === 0 && (
                    <div className="p-3 text-center text-sm" style={{ color: 'var(--text-muted)' }}>{t('createTask.noFound')}</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Sprint */}
          <div ref={sprintRef} style={{ position: 'relative' }}>
            <label className="block text-xs font-medium mb-1" style={{ color: form.project ? 'var(--text-dim)' : 'var(--text-muted)' }}>{t('createTask.sprintLabel')}</label>
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!form.project) return;
                  setShowSprintDropdown(!showSprintDropdown);
                  setShowProjectDropdown(false);
                  setShowUserDropdown(false);
                  setShowEpicDropdown(false);
                  setShowComponentDropdown(false);
                  setShowIssueTypeDropdown(false);
                  setShowPriorityDropdown(false);
                }}
                disabled={!form.project}
                className="input-field w-full px-3 py-2 text-sm flex items-center justify-between"
                style={{
                  cursor: form.project ? 'pointer' : 'not-allowed',
                  opacity: form.project ? 1 : 0.5,
                  pointerEvents: form.project ? 'auto' : 'none',
                }}
              >
                <span style={{ color: form.customFieldSprint ? 'var(--text)' : 'var(--text-muted)' }}>
                  {form.customFieldSprint ? sprints.find((s) => String(s.id) === form.customFieldSprint)?.name : t('createTask.sprintPlaceholder')}
                </span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--text-muted)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showSprintDropdown && form.project && (
                <div className="absolute top-full left-0 mt-1 w-full rounded-xl z-50 overflow-hidden" style={{ ...dropdownStyle, maxHeight: '240px', overflowY: 'auto' }}>
                  <div className="sticky top-0 p-2 border-b" style={{ borderColor: 'var(--border)', background: 'var(--dropdown-bg)' }}>
                    <input
                      type="text"
                      value={sprintFilter}
                      onChange={(e) => setSprintFilter(e.target.value)}
                      placeholder={t('createTask.sprintFilterPlaceholder')}
                      className="w-full px-3 py-1.5 text-sm"
                      style={{ background: 'transparent', border: 'none', color: 'var(--text)', outline: 'none' }}
                    />
                  </div>
                  {sprintLoading && <div className="p-3 text-center text-sm" style={{ color: 'var(--text-muted)' }}>{t('jql.loading')}</div>}
                  {sprintError && <div className="p-3 text-center text-sm" style={{ color: 'var(--danger)' }}>{sprintError}</div>}
                  {!sprintLoading && !sprintError && filteredSprints.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className="w-full px-3 py-2 text-left flex items-center justify-between gap-2 transition-all duration-150"
                      style={{
                        color: form.customFieldSprint === String(s.id) ? 'var(--accent)' : 'var(--text)',
                        background: form.customFieldSprint === String(s.id) ? 'var(--accent-bg)' : 'transparent',
                        fontWeight: form.customFieldSprint === String(s.id) ? 500 : 400,
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => { if (form.customFieldSprint !== String(s.id)) e.currentTarget.style.background = 'var(--surface-hover)'; }}
                      onMouseLeave={(e) => { if (form.customFieldSprint !== String(s.id)) e.currentTarget.style.background = 'transparent'; }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setForm({ ...form, customFieldSprint: String(s.id) });
                        setShowSprintDropdown(false);
                        setSprintFilter('');
                      }}
                    >
                      <span className="text-sm truncate flex-1">{s.name}</span>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {s.state === 'active' ? t('createTask.sprintActive') : t('createTask.sprintFuture')}
                      </span>
                    </button>
                  ))}
                  {!sprintLoading && !sprintError && filteredSprints.length === 0 && (
                    <div className="p-3 text-center text-sm" style={{ color: 'var(--text-muted)' }}>{t('createTask.noSprintFound')}</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Assignee */}
          <div ref={userRef} style={{ position: 'relative' }}>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-dim)' }}>{t('createTask.assigneeLabel')}</label>
            <div className="relative">
              <input
                type="text"
                value={form.assignee}
                onChange={(e) => {
                  setForm({ ...form, assignee: e.target.value });
                  setShowUserDropdown(true);
                }}
                onFocus={() => { if (form.assignee) setShowUserDropdown(true); }}
                placeholder={t('createTask.assigneePlaceholder')}
                className="input-field w-full px-3 py-2 text-sm"
                style={{ paddingRight: '32px' }}
              />
              {userLoading && (
                <svg className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 animate-spin" style={{ color: 'var(--text-muted)' }} viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {showUserDropdown && users.length > 0 && (
                <div className="absolute top-full left-0 mt-1 w-full rounded-xl z-50 overflow-hidden" style={{ ...dropdownStyle, maxHeight: '200px', overflowY: 'auto' }}>
                  {users.map((u) => (
                    <button
                      key={u.name}
                      type="button"
                      className="w-full px-3 py-2 text-left transition-all duration-150"
                      style={{ color: 'var(--text)', cursor: 'pointer' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-hover)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      onClick={(e) => {
                        e.stopPropagation();
                        setForm({ ...form, assignee: u.name });
                        setShowUserDropdown(false);
                      }}
                    >
                      <span className="text-sm">{u.displayName}</span>
                      <span className="text-xs ml-2" style={{ color: 'var(--text-muted)' }}>@{u.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Labels */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-dim)' }}>{t('createTask.labelsLabel')}</label>
            <input
              type="text"
              value={form.labels}
              onChange={(e) => setForm({ ...form, labels: e.target.value })}
              placeholder={t('createTask.labelsPlaceholder')}
              className="input-field w-full px-3 py-2 text-sm"
            />
          </div>

          {/* Original Estimate */}
          <div style={{ position: 'relative' }}>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-dim)' }}>{t('createTask.originalEstimateLabel')}</label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                value={form.originalEstimate}
                onChange={(e) => setForm({ ...form, originalEstimate: e.target.value })}
                placeholder={t('createTask.originalEstimatePlaceholder')}
                className="input-field w-full px-3 py-2 text-sm"
                style={{ paddingRight: '44px' }}
              />
              <button
                type="button"
                onClick={() => setForm({ ...form, remainingEstimate: form.originalEstimate })}
                className="absolute right-2 top-1/2 -translate-y-1/2"
                style={{
                  background: 'var(--surface-light)',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                }}
                title={t('createTask.copyToRemaining')}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Remaining Estimate */}
          <div style={{ position: 'relative' }}>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-dim)' }}>{t('createTask.remainingEstimateLabel')}</label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                value={form.remainingEstimate}
                onChange={(e) => setForm({ ...form, remainingEstimate: e.target.value })}
                placeholder={t('createTask.remainingEstimatePlaceholder')}
                className="input-field w-full px-3 py-2 text-sm"
                style={{ paddingRight: '44px' }}
              />
              <button
                type="button"
                onClick={() => setForm({ ...form, remainingEstimate: form.originalEstimate })}
                className="absolute right-2 top-1/2 -translate-y-1/2"
                style={{
                  background: 'var(--surface-light)',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                }}
                title={t('createTask.copyFromOriginal')}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Start Date */}
          <div style={{ position: 'relative' }}>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-dim)' }}>{t('createTask.startDateLabel')}</label>
            <div style={{ position: 'relative' }}>
              <input
                type="datetime-local"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="input-field w-full px-3 py-2 text-sm"
                style={{ paddingRight: '44px' }}
              />
              <div
                style={{
                  position: 'absolute',
                  right: '6px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '24px',
                  height: '24px',
                  cursor: 'pointer',
                  pointerEvents: 'auto',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onClick={() => {
                  const el = document.getElementById('start-date-input') as HTMLInputElement | null;
                  el?.showPicker?.();
                }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Due Date */}
          <div style={{ position: 'relative' }}>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-dim)' }}>{t('createTask.dueDateLabel')}</label>
            <div style={{ position: 'relative' }}>
              <input
                id="due-date-input"
                type="datetime-local"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                className="input-field w-full px-3 py-2 text-sm"
                style={{ paddingRight: '44px' }}
              />
              <div
                style={{
                  position: 'absolute',
                  right: '6px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '24px',
                  height: '24px',
                  cursor: 'pointer',
                  pointerEvents: 'auto',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onClick={() => {
                  const el = document.getElementById('due-date-input') as HTMLInputElement | null;
                  el?.showPicker?.();
                }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column - 9/12 Main Form */}
      <div className="flex-1 overflow-y-auto">
        <div className="sticky top-0 p-4 space-y-4" style={{ background: 'var(--surface)', zIndex: 1 }}>
          {/* Issue Title */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-dim)' }}>{t('createTask.issueTitleLabel')}</label>
            <input
              type="text"
              required
              value={form.summary}
              onChange={(e) => setForm({ ...form, summary: e.target.value })}
              placeholder={t('createTask.issueTitlePlaceholder')}
              className="input-field w-full px-3 py-2 text-sm"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-dim)' }}>{t('createTask.descriptionLabel')}</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder={t('createTask.descriptionPlaceholder')}
              className="input-field w-full px-3 py-2 text-sm resize-none"
              style={{ minHeight: 'calc(100vh - 250px)' }}
            />
          </div>

          {/* Success/Error */}
          {success && (
            <div className="rounded-xl p-3 animate-slide-up" style={{ background: 'var(--success-bg)' }}>
              <p className="text-xs font-medium" style={{ color: 'var(--success)' }}>
                Task created successfully! Key:{' '}
                {createdIssueUrl ? (
                  <a
                    href={createdIssueUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline font-mono"
                    style={{ color: 'var(--success)' }}
                  >
                    {createdKey}
                  </a>
                ) : (
                  <span className="font-mono">{createdKey}</span>
                )}
              </p>
            </div>
          )}

          {error && (
            <div className="rounded-xl p-3 animate-slide-up" style={{ background: 'var(--danger-bg)' }}>
              <p className="text-xs" style={{ color: 'var(--danger)' }}>{error}</p>
            </div>
          )}

          {/* Submit */}
          <div className="flex justify-end pt-2">
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
        </div>
      </div>
    </form>
  );
}








