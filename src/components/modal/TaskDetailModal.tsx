'use client';

import { JiraIssue, JiraTransition, JiraTransitionField, JiraEditMeta } from '@/types/jira';
import { useLanguage } from '@/lib/i18n';
import { buildTransitionFields, normalizeRemainingEstimateValue } from '@/lib/jira/transitionPayload';
import { getDescriptionPlaceholder, runIssueRefresh } from './taskDetailModal.helpers.js';
import { useEffect, useState, useRef, useCallback, type ChangeEvent } from 'react';

interface TaskDetailModalProps {
  issue: JiraIssue | null;
  onClose: () => void;
  onLogWork?: () => void;
  onRefresh?: (issue: JiraIssue) => Promise<JiraIssue | null | void>;
}

function formatTime(seconds: number | null): string {
  if (seconds === null || seconds === 0) return '0h';
  const hours = seconds / 3600;
  const days = Math.floor(hours / 24);
  const dayHours = Math.floor(hours % 24);
  const minutes = Math.round((hours % 1) * 60);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (dayHours > 0) parts.push(`${dayHours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  return parts.length > 0 ? parts.join(' ') : '0h';
}

function parseJiraTime(timeStr: string): number {
  if (!timeStr) return 0;
  const regex = /(?:(\d+)d)?\s*(?:(\d+)h)?\s*(?:(\d+)m)?/;
  const match = timeStr.match(regex);
  if (!match) return 0;
  const days = parseInt(match[1] || '0');
  const hours = parseInt(match[2] || '0');
  const minutes = parseInt(match[3] || '0');
  return days * 86400 + hours * 3600 + minutes * 60;
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '-';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch {
    return '-';
  }
}

function formatDateTimeForInput(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch {
    return '';
  }
}

function formatJiraDatetime(dateInput: string): string | null {
  if (!dateInput) return null;
  return `${dateInput}:00.000+0700`;
}

function getAvatarUrl(user: { avatarUrls?: Record<string, string>; displayName: string } | null): string {
  if (!user?.avatarUrls) return '';
  return user.avatarUrls[48] || '';
}

const STATUS_OPTIONS = ['To Do', 'In Progress', 'Pending', 'In Review', 'Waiting', 'Resolved', 'Closed', 'Done', 'Open'];

const PRIORITY_OPTIONS = ['Highest', 'High', 'Medium', 'Low', 'Lowest', 'None'];

const FIELD_API_MAPPING: Record<string, string> = {
  summary: 'summary',
  priority: 'priority',
  assignee: 'assignee',
  reporter: 'reporter',
  sprint: 'sprint',
  timeoriginalestimate: 'timeoriginalestimate',
  timeestimate: 'timeestimate',
  timespent: 'timespent',
  startDate: 'customfield_10300',
  dueDate: 'customfield_10302',
  resolutionDate: 'resolutiondate',
  description: 'description',
  epic: 'epic',
  parent: 'parent',
  labels: 'labels',
  resolution: 'resolution',
  issuetype: 'issuetype',
};

const STATUS_MAP: Record<string, { bg: string; text: string; border: string }> = {
  'To Do': { bg: 'rgba(141,145,156,0.08)', text: '#8d919c', border: 'rgba(141,145,156,0.15)' },
  'In Progress': { bg: 'rgba(164,148,245,0.12)', text: '#a494f5', border: 'rgba(164,148,245,0.25)' },
  'Done': { bg: 'rgba(109,212,158,0.12)', text: '#6dd49e', border: 'rgba(109,212,158,0.25)' },
  'In Review': { bg: 'rgba(251,191,36,0.12)', text: '#fbbf24', border: 'rgba(251,191,36,0.25)' },
  'Waiting': { bg: 'rgba(251,146,60,0.12)', text: '#fb923c', border: 'rgba(251,146,60,0.25)' },
  'Resolved': { bg: 'rgba(109,212,158,0.12)', text: '#6dd49e', border: 'rgba(109,212,158,0.25)' },
  'Closed': { bg: 'rgba(109,212,158,0.12)', text: '#6dd49e', border: 'rgba(109,212,158,0.25)' },
  'Open': { bg: 'rgba(164,148,245,0.12)', text: '#a494f5', border: 'rgba(164,148,245,0.25)' },
};

const PRIORITY_MAP: Record<string, { bg: string; text: string; border: string }> = {
  'Highest': { bg: 'rgba(242,144,150,0.15)', text: '#f29096', border: 'rgba(242,144,150,0.3)' },
  'High': { bg: 'rgba(242,144,150,0.12)', text: '#f29096', border: 'rgba(242,144,150,0.25)' },
  'Medium': { bg: 'rgba(251,191,36,0.12)', text: '#fbbf24', border: 'rgba(251,191,36,0.25)' },
  'Low': { bg: 'rgba(109,212,158,0.1)', text: '#6dd49e', border: 'rgba(109,212,158,0.2)' },
  'Lowest': { bg: 'rgba(141,145,156,0.06)', text: '#8d919c', border: 'rgba(141,145,156,0.12)' },
  'None': { bg: 'rgba(82,86,95,0.08)', text: '#52565f', border: 'rgba(82,86,95,0.15)' },
};

const DARK = {
  cardBg: 'rgba(20,22,40,0.92)',
  backdropBlur: 'rgba(0,0,0,0.75)',
  border: 'rgba(255,255,255,0.1)',
  borderRow: 'rgba(255,255,255,0.08)',
  accent: '#a094e8',
  accentBg: 'rgba(160,148,232,0.15)',
  accentBorder: 'rgba(160,148,232,0.35)',
  textPrimary: '#e8eaf0',
  textSecondary: '#9095a8',
  textMuted: '#5a5f6e',
  cardBgInner: 'rgba(20,22,40,0.4)',
  chipBg: 'rgba(255,255,255,0.06)',
  chipBorder: 'rgba(255,255,255,0.1)',
  chipText: '#c0c4d4',
};

const LIGHT = {
  cardBg: 'rgba(255,255,255,0.95)',
  backdropBlur: 'rgba(0,0,0,0.3)',
  border: 'rgba(0,0,0,0.1)',
  borderRow: 'rgba(0,0,0,0.06)',
  accent: '#635de8',
  accentBg: 'rgba(99,102,241,0.08)',
  accentBorder: 'rgba(99,102,241,0.25)',
  textPrimary: '#1a1c28',
  textSecondary: '#5a5f70',
  textMuted: '#7a7f90',
  cardBgInner: 'rgba(255,255,255,0.6)',
  chipBg: 'rgba(0,0,0,0.04)',
  chipBorder: 'rgba(0,0,0,0.08)',
  chipText: '#3a3e4e',
};

function Chip({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
      style={{
        background: 'rgba(255,255,255,0.06)',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: 'rgba(255,255,255,0.1)',
        color: '#c0c4d4',
        ...style,
      }}
    >
      {children}
    </span>
  );
}

function LightChip({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
      style={{
        background: 'rgba(0,0,0,0.04)',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: 'rgba(0,0,0,0.08)',
        color: '#3a3e4e',
        ...style,
      }}
    >
      {children}
    </span>
  );
}

function ValueLabel({ label, children, c, chipStyle }: { label: string; children: React.ReactNode; c: typeof DARK; chipStyle?: React.CSSProperties }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wider mb-1.5" style={{ color: c.textMuted }}>{label}</div>
      {children}
    </div>
  );
}

function EditInput({ value, onChange, style, textPrimary, borderColor, theme }: { value: string; onChange: (v: string) => void; style?: React.CSSProperties; textPrimary: string; borderColor: string; theme?: 'dark' | 'light' }) {
  const bg = theme === 'light' ? 'rgba(99,102,241,0.06)' : 'rgba(160,148,232,0.1)';
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="px-2.5 py-1 rounded-lg text-xs font-medium flex-1 min-w-0"
      style={{
        background: bg,
        border: `1px solid ${borderColor}`,
        color: textPrimary,
        outline: 'none',
        ...style,
      }}
    />
  );
}

function EditSelect({ value, onChange, options, style, textPrimary, borderColor, cardBgInner, theme }: { value: string; onChange: (v: string) => void; options: string[]; style?: React.CSSProperties; textPrimary: string; borderColor: string; cardBgInner: string; theme?: 'dark' | 'light' }) {
  const bg = theme === 'light' ? 'rgba(99,102,241,0.06)' : 'rgba(160,148,232,0.1)';
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="px-2.5 py-1 rounded-lg text-xs font-medium flex-1 min-w-0"
      style={{
        background: bg,
        border: `1px solid ${borderColor}`,
        color: textPrimary,
        outline: 'none',
        ...style,
      }}
    >
      {options.map((opt) => (
        <option key={opt} value={opt} style={{ background: cardBgInner, color: textPrimary }}>{opt}</option>
      ))}
    </select>
  );
}

function EditTextArea({ value, onChange, style, textPrimary, borderColor, placeholder, theme }: { value: string; onChange: (v: string) => void; style?: React.CSSProperties; textPrimary: string; borderColor: string; placeholder?: string; theme?: 'dark' | 'light' }) {
  const bg = theme === 'light' ? 'rgba(99,102,241,0.06)' : 'rgba(160,148,232,0.1)';
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="px-2.5 py-1 rounded-lg text-xs font-medium w-full resize-none"
      rows={3}
      placeholder={placeholder || ''}
      style={{
        background: bg,
        border: `1px solid ${borderColor}`,
        color: textPrimary,
        outline: 'none',
        resize: 'vertical',
        ...style,
      }}
    />
  );
}

function DateTimePickerField({ value, onChange, textPrimary, borderColor, theme }: { value: string; onChange: (v: string) => void; textPrimary: string; borderColor: string; theme?: 'dark' | 'light' }) {
  const bg = theme === 'light' ? 'rgba(99,102,241,0.06)' : 'rgba(160,148,232,0.1)';
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const [displayValue, setDisplayValue] = useState(formatDateTimeFromInput(value));

  useEffect(() => {
    setDisplayValue(formatDateTimeFromInput(value));
  }, [value]);

  const handleDisplayClick = useCallback(() => {
    if (hiddenInputRef.current) {
      hiddenInputRef.current.value = value;
      hiddenInputRef.current.showPicker?.();
    }
  }, [value]);

  const handleNativeChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
  }, [onChange]);

  return (
    <>
      <input
        ref={hiddenInputRef}
        type="datetime-local"
        onChange={handleNativeChange}
        className="sr-only"
        tabIndex={-1}
        style={{ width: 0, height: 0, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}
      />
      <div
        className="px-2.5 py-1 rounded-lg text-xs font-medium flex-1 min-w-0 flex items-center gap-1.5"
        style={{
          background: bg,
          border: `1px solid ${borderColor}`,
          color: textPrimary,
          outline: 'none',
          cursor: 'pointer',
        }}
        onClick={handleDisplayClick}
      >
        <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span>{displayValue || '-'}</span>
      </div>
    </>
  );
}

function formatDateTimeFromInput(inputValue: string): string {
  if (!inputValue || inputValue === '-') return '-';
  try {
    const d = new Date(inputValue + ':00');
    if (isNaN(d.getTime())) return inputValue;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch {
    return inputValue;
  }
}

export default function TaskDetailModal({ issue, onClose, onLogWork, onRefresh }: TaskDetailModalProps) {
  const { t, language } = useLanguage();
  const [isLight, setIsLight] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editedValues, setEditedValues] = useState<Record<string, string | null>>({});
  const [editMeta, setEditMeta] = useState<JiraEditMeta | null>(null);
  const [editMetaLoading, setEditMetaLoading] = useState(false);
  const [datetimeValues, setDatetimeValues] = useState<Record<string, string>>({});
  const modalRef = useRef<HTMLDivElement>(null);

  // Transition state
  const [showTransitionMenu, setShowTransitionMenu] = useState(false);
  const [transitions, setTransitions] = useState<JiraTransition[]>([]);
  const [transitionLoading, setTransitionLoading] = useState(false);
  const [transitionError, setTransitionError] = useState<string | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [selectedTransition, setSelectedTransition] = useState<JiraTransition | null>(null);
  const [transitionFieldsData, setTransitionFieldsData] = useState<Record<string, JiraTransitionField>>({});
  const [fieldValues, setFieldValues] = useState<Record<string, string | null>>({});
  const transitionMenuRef = useRef<HTMLDivElement>(null);
  const transitionRequestIdRef = useRef(0);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (transitionMenuRef.current && !transitionMenuRef.current.contains(e.target as Node)) {
        setShowTransitionMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchTransitions = useCallback(async (issueKey: string) => {
    const requestId = ++transitionRequestIdRef.current;
    setShowTransitionMenu(false);
    setTransitions([]);
    setTransitionLoading(true);
    setTransitionError(null);
    setSelectedTransition(null);
    setTransitionFieldsData({});
    setFieldValues({});
    try {
      const res = await fetch(`/api/jira/transitions?key=${encodeURIComponent(issueKey)}`);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `Failed to fetch transitions (${res.status})`);
      }

      const data = await res.json();
      if (transitionRequestIdRef.current !== requestId) {
        return;
      }

      if (data.transitions) {
        setTransitions(data.transitions);
      } else {
        setTransitions([]);
      }
    } catch (err) {
      if (transitionRequestIdRef.current === requestId) {
        setTransitionError(err instanceof Error ? err.message : 'Failed to fetch transitions');
        setTransitions([]);
      }
    } finally {
      if (transitionRequestIdRef.current === requestId) {
        setTransitionLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!issue) return;
    fetchTransitions(issue.key);
  }, [issue, fetchTransitions]);

  useEffect(() => {
    return () => {
      transitionRequestIdRef.current += 1;
    };
  }, []);

  const handleStatusArrowClick = useCallback(async () => {
    if (!issue) return;
    setShowTransitionMenu((prev) => !prev);
  }, [issue]);

  const handleTransitionSelect = useCallback((transition: JiraTransition) => {
    if (!issue) return;

    setSelectedTransition(transition);
    setTransitionFieldsData(transition.fields || {});
    setShowTransitionMenu(false);

    const initialValues: Record<string, string | null> = {};
    for (const [fieldId, fieldDef] of Object.entries(transition.fields || {})) {
      if (fieldDef.schema?.type === 'resolution' && fieldDef.allowedValues?.length) {
        initialValues[fieldId] = fieldDef.allowedValues[0].name;
      } else if (fieldId === 'customfield_10304') {
        initialValues[fieldId] = '';
      } else if (fieldId === 'customfield_10300') {
        initialValues[fieldId] = issue.fields.customfield_10300 || issue.fields.startdate || '';
      } else if (fieldId === 'customfield_10302') {
        initialValues[fieldId] = issue.fields.customfield_10302 || issue.fields.duedate || '';
      } else if (fieldId === 'timetracking') {
        initialValues[fieldId] = normalizeRemainingEstimateValue(issue.fields.timeestimate);
      } else if (fieldDef.required) {
        initialValues[fieldId] = '';
      } else {
        initialValues[fieldId] = '';
      }
    }
    setFieldValues(initialValues);
  }, [issue]);

  const handleTransitionSubmit = useCallback(async () => {
    if (!selectedTransition || !issue) return;
    setTransitioning(true);
    setTransitionError(null);
    try {
      const transitionPayload = buildTransitionFields(selectedTransition.fields, fieldValues, issue.fields);

      const response = await fetch('/api/jira/transitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: issue.key,
          transitionId: selectedTransition.id,
          fields: transitionPayload,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || `Transition failed (${response.status})`);
      }

      await runIssueRefresh(issue, onRefresh);
      setSelectedTransition(null);
      setTransitionFieldsData({});
      setFieldValues({});
    } catch (err) {
      setTransitionError(err instanceof Error ? err.message : 'Transition failed');
    } finally {
      setTransitioning(false);
    }
  }, [selectedTransition, issue, fieldValues, onRefresh]);

  const updateField = useCallback((fieldId: string, value: string) => {
    setFieldValues(prev => ({ ...prev, [fieldId]: value }));
  }, []);

  useEffect(() => {
    setIsLight(document.documentElement.getAttribute('data-theme') === 'light');
    const observer = new MutationObserver(() => {
      setIsLight(document.documentElement.getAttribute('data-theme') === 'light');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  const c = isLight ? LIGHT : DARK;
  const ChipComp = isLight ? LightChip : Chip;

  const editModeRef = useRef(editMode);
  editModeRef.current = editMode;

  const getInitialValue = (field: string, original: unknown): string => {
    const edited = editedValues[field];
    if (edited !== undefined && edited !== null) return String(edited);
    return String(original ?? '');
  };

  const handleEdit = (field: string, value: string) => {
    setEditedValues((prev) => {
      const origValue = getOriginalValueForCompare(field);
      if (value === origValue) {
        const next = { ...prev };
        delete next[field];
        return next;
      }
      return { ...prev, [field]: value };
    });
  };

  const getOriginalValueForCompare = (field: string): string => {
    switch (field) {
      case 'summary': return f.summary || '';
      case 'priority': return f.priority?.name || '';
      case 'assignee': return f.assignee?.displayName || '';
      case 'reporter': return f.reporter?.displayName || '';
      case 'sprint': return f.sprint?.name || '';
      case 'timeoriginalestimate': return f.timeoriginalestimate ? formatTime(parseInt(f.timeoriginalestimate)) : '0h';
      case 'timeestimate': return f.timeestimate ? formatTime(parseInt(f.timeestimate)) : '0h';
      case 'timespent': return f.timespent ? formatTime(parseInt(f.timespent)) : '0h';
      case 'startDate': return formatDateTime(f.customfield_10300 || f.startdate);
      case 'dueDate': return formatDateTime(f.customfield_10302 || f.duedate);
      case 'resolutionDate': return formatDateTime(f.resolutiondate);
      case 'description': return f.description || '';
      case 'epic': return f.epic?.key || '';
      case 'parent': return f.parent?.key || '';
      case 'labels': return f.labels?.join(', ') || '';
      case 'resolution': return f.resolution?.name || '';
      case 'issuetype': return f.issuetype.name || '';
      default: return '';
    }
  };

  const buildUpdateFields = useCallback((): Record<string, unknown> => {
    const updateFields: Record<string, unknown> = {};

    if (isFieldEditable('summary') && editedValues.summary !== undefined) updateFields.summary = editedValues.summary;
    if (isFieldEditable('priority') && editedValues.priority !== undefined) updateFields.priority = editedValues.priority ? { name: editedValues.priority } : null;
    if (isFieldEditable('assignee') && editedValues.assignee !== undefined) updateFields.assignee = editedValues.assignee ? { name: editedValues.assignee } : null;
    if (isFieldEditable('startDate') && datetimeValues.startDate !== undefined && datetimeValues.startDate) updateFields.customfield_10300 = formatJiraDatetime(datetimeValues.startDate);
    if (isFieldEditable('dueDate') && datetimeValues.dueDate !== undefined && datetimeValues.dueDate) updateFields.customfield_10302 = formatJiraDatetime(datetimeValues.dueDate);
    if (isFieldEditable('resolutionDate') && datetimeValues.resolutionDate !== undefined && datetimeValues.resolutionDate) updateFields.resolutiondate = formatJiraDatetime(datetimeValues.resolutionDate);
    if (isFieldEditable('description') && editedValues.description !== undefined) updateFields.description = editedValues.description;
    if (isFieldEditable('timeoriginalestimate') && editedValues.timeoriginalestimate !== undefined && editedValues.timeoriginalestimate) {
      updateFields.timeoriginalestimate = parseJiraTime(editedValues.timeoriginalestimate);
    }
    if (isFieldEditable('timeestimate') && editedValues.timeestimate !== undefined && editedValues.timeestimate) {
      updateFields.timeestimate = parseJiraTime(editedValues.timeestimate);
    }

    return updateFields;
  }, [datetimeValues, editedValues, editMeta, editMetaLoading, editMode]);

  const handleSave = useCallback(async () => {
    if (!issue || saving) return;

    const previousEditedValues = { ...editedValues };
    const previousDatetimeValues = { ...datetimeValues };

    try {
      const updateFields = buildUpdateFields();

      setSaveError(null);
      setEditMode(false);
      setSaving(true);

      if (Object.keys(updateFields).length === 0) {
        setEditedValues({});
        setDatetimeValues({});
        return;
      }

      const res = await fetch('/api/jira/update-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: issue.key, fields: updateFields }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Update failed');
      }
      await runIssueRefresh(issue, onRefresh);
      setEditedValues({});
      setDatetimeValues({});
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Unknown error');
      setEditMode(true);
      setEditedValues(previousEditedValues);
      setDatetimeValues(previousDatetimeValues);
    } finally {
      setSaving(false);
    }
  }, [buildUpdateFields, datetimeValues, editedValues, issue, onRefresh, saving]);

  const isFieldEditable = (field: string): boolean => {
    if (!editMode) return false;
    if (editMetaLoading || !editMeta) return true;
    const apiField = FIELD_API_MAPPING[field];
    if (!apiField) return false;
    const fieldMeta = editMeta.fields?.[apiField];
    if (!fieldMeta) return false;
    return fieldMeta.operations.includes('set') || fieldMeta.operations.includes('edit');
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F2' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        setEditMode((prev) => {
          const next = !prev;
          if (next && issue) {
            setDatetimeValues({
              startDate: formatDateTimeForInput(issue.fields.customfield_10300 || issue.fields.startdate),
              dueDate: formatDateTimeForInput(issue.fields.customfield_10302 || issue.fields.duedate),
              resolutionDate: formatDateTimeForInput(issue.fields.resolutiondate),
            });
          } else if (!next) {
            setDatetimeValues({});
          }
          return next;
        });
      } else if (e.key === 'F10' && editModeRef.current && issue) {
        e.preventDefault();
        void handleSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSave, issue]);

  useEffect(() => {
    if (!issue) return;
    setEditMetaLoading(true);
    setEditMeta(null);
    fetch(`/api/jira/edit-meta?key=${encodeURIComponent(issue.key)}`)
      .then((res) => res.json())
      .then((data) => {
        setEditMeta(data);
      })
      .catch(() => {})
      .finally(() => {
        setEditMetaLoading(false);
      });
  }, [issue?.key]);

  const currentIssue = issue;
  if (!currentIssue) return null;
  const f = currentIssue.fields;

  const baseUrl = process.env.NEXT_PUBLIC_JIRA_BASE_URL || 'https://your-domain.atlassian.net';
  const issueUrl = `${baseUrl}/browse/${currentIssue.key}`;

  const getAssigneeName = (user: { displayName: string; name: string } | null) => {
    if (!user) return isLight ? 'Unassigned' : 'Chưa gán';
    return user.displayName || user.name || (isLight ? 'Unassigned' : 'Chưa gán');
  };

  const statusText = STATUS_MAP[f.status.name];
  const priorityText = PRIORITY_MAP[f.priority?.name || 'None'];

  const transitionFormFields = Object.entries(transitionFieldsData || {});

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onMouseDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (editMode) {
          setEditMode(false);
          setEditedValues({});
        } else {
          onClose();
        }
      }}
      style={{
        background: c.backdropBlur,
        backdropFilter: 'blur(8px)',
      }}
    >
      <div
        ref={modalRef}
        className="relative w-[80vw] max-w-[80vw] h-[90vh] max-h-[90vh] overflow-hidden rounded-2xl flex flex-col"
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
        {saving && (
          <div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3"
            style={{ background: isLight ? 'rgba(255,255,255,0.72)' : 'rgba(20,22,40,0.72)', backdropFilter: 'blur(10px)' }}
          >
            <div
              className="w-9 h-9 rounded-full animate-spin"
              style={{
                borderWidth: '3px',
                borderStyle: 'solid',
                borderColor: isLight ? 'rgba(99,102,241,0.18)' : 'rgba(160,148,232,0.18)',
                borderTopColor: c.accent,
              }}
            />
            <div className="text-sm font-medium" style={{ color: c.textPrimary }}>Đang lưu thay đổi...</div>
          </div>
        )}
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b shrink-0"
          style={{ borderColor: c.borderRow, background: c.cardBg }}
        >
          <div className="min-w-0 flex-1 pr-4">
            <div className="flex items-start gap-3 mb-2 min-w-0">
              <ChipComp style={{ background: isLight ? 'rgba(99,102,241,0.1)' : 'rgba(160,148,232,0.15)', borderColor: isLight ? 'rgba(99,102,241,0.2)' : 'rgba(160,148,232,0.35)', color: c.accent }}>
                {currentIssue.key}
              </ChipComp>
              <div className="min-w-0 flex-1">
                {editMode ? (
                  isFieldEditable('summary') ? (
                    <EditInput
                      value={getInitialValue('summary', f.summary)}
                      onChange={(v) => handleEdit('summary', v)}
                      textPrimary={c.textPrimary}
                      borderColor={c.chipBorder}
                      theme={isLight ? 'light' : 'dark'}
                      style={{ fontWeight: 500, width: '100%' }}
                    />
                  ) : (
                    <span className="block w-full text-sm font-medium leading-relaxed overflow-hidden text-ellipsis whitespace-nowrap" style={{ color: c.textPrimary }}>{f.summary}</span>
                  )
                ) : (
                  <span className="block w-full text-sm font-medium leading-relaxed overflow-hidden text-ellipsis whitespace-nowrap" style={{ color: c.textPrimary }}>{f.summary}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {editMode && (
              <>
                <div className="text-[11px] font-medium whitespace-nowrap" style={{ color: '#fbbf24' }}>
                  EDIT MODE - Nhấn F10 để lưu
                  {editMetaLoading && <span style={{ color: c.textMuted }}>&nbsp;| Loading edit meta...</span>}
                </div>
                <button
                  onClick={() => { void handleSave(); }}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg"
                  style={{
                    color: '#6dd49e',
                    background: 'rgba(109,212,158,0.15)',
                    border: '1px solid rgba(109,212,158,0.35)',
                    cursor: 'pointer',
                  }}
                >
                  Save
                </button>
                <button
                  onClick={() => { setEditMode(false); setEditedValues({}); }}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg"
                  style={{ color: c.textMuted, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  Cancel
                </button>
              </>
            )}
            <button
              onClick={() => onLogWork?.()}
              className="text-xs font-medium hover:underline px-3 py-1.5 rounded-lg"
              style={{ color: c.accent, background: c.accentBg, border: `1px solid ${c.accentBorder}` }}
            >
              {t('logWork.title')}
            </button>
            <a
              href={issueUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium hover:underline px-3 py-1.5 rounded-lg"
              style={{ color: c.accent, background: c.accentBg, border: `1px solid ${c.accentBorder}` }}
            >
              {t('dialog.link')}
            </a>
            <button
              onClick={() => { if (editMode) { setEditMode(false); setEditedValues({}); } else { onClose(); } }}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-sm"
              style={{ color: c.textMuted, background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(20,22,40,0.5)' }}
              title={t('dialog.close')}
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-y-auto">
          <div className="w-full px-6 py-5">
            {saveError && (
              <div className="p-3 rounded-lg text-xs mb-5" style={{ background: 'rgba(242,144,150,0.15)', color: '#f29096', border: '1px solid rgba(242,144,150,0.3)' }}>
                {saveError}
              </div>
            )}
            <div className="text-xs mb-5" style={{ color: c.textMuted }}>{t('dialog.id')}: {currentIssue.id}</div>
            {/* Status + Priority + Type */}
            <div className="grid grid-cols-3 gap-4 mb-5">
              <ValueLabel label={t('dialog.status')} c={c}>
                <div className="flex items-center gap-1.5">
                  <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer"
                    style={{
                      background: statusText?.bg || (isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.06)'),
                      color: statusText?.text || c.chipText,
                      borderWidth: '1px',
                      borderStyle: 'solid',
                      borderColor: statusText?.border || c.chipBorder,
                    }}
                    onClick={handleStatusArrowClick}
                  >
                    {f.status.name}
                  </span>
                  <button
                    onClick={handleStatusArrowClick}
                    className="flex items-center justify-center w-5 h-5 rounded"
                    style={{
                      color: statusText?.text || c.chipText,
                      background: 'transparent',
                      cursor: 'pointer',
                      border: 'none',
                    }}
                    title={t('dialog.transition')}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </button>
                </div>
              </ValueLabel>
              <ValueLabel label={t('dialog.priority')} c={c}>
                {editMode ? (
                  isFieldEditable('priority') ? (
                    <EditSelect value={getInitialValue('priority', f.priority?.name || '')} options={PRIORITY_OPTIONS} onChange={(v) => handleEdit('priority', v)} textPrimary={c.textPrimary} cardBgInner={c.cardBgInner} borderColor={c.chipBorder} theme={isLight ? 'light' : 'dark'} />
                  ) : (
                    <ChipComp style={{
                      background: priorityText?.bg || (isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.06)'),
                      color: priorityText?.text || c.chipText,
                      borderColor: priorityText?.border || c.chipBorder,
                    }}>
                      {f.priority?.name || (isLight ? 'None' : 'Không')}
                    </ChipComp>
                  )
                ) : (
                  <ChipComp style={{
                    background: priorityText?.bg || (isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.06)'),
                    color: priorityText?.text || c.chipText,
                    borderColor: priorityText?.border || c.chipBorder,
                  }}>
                    {f.priority?.name || (isLight ? 'None' : 'Không')}
                  </ChipComp>
                )}
              </ValueLabel>
              <ValueLabel label={t('dialog.issuetype')} c={c}>
                <ChipComp>
                  {f.issuetype.iconUrl && <img src={f.issuetype.iconUrl} alt="" className="w-4 h-4" />}
                  {f.issuetype.name}
                </ChipComp>
              </ValueLabel>
            </div>

            {/* Transition dropdown */}
            {showTransitionMenu && (
              <div className="relative" ref={transitionMenuRef}>
                <div
                  className="absolute top-full left-0 mt-1 w-full rounded-xl z-50 overflow-hidden"
                  style={{
                    background: c.cardBg,
                    border: `1px solid ${c.border}`,
                    backdropFilter: 'blur(32px) saturate(1.6)',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                  }}
                >
                  <div className="px-3 py-2 border-b" style={{ borderColor: c.borderRow }}>
                    <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: c.textMuted }}>{t('dialog.transitionStatus')}</span>
                  </div>
                  {transitionLoading ? (
                    <div className="p-3 text-center text-xs" style={{ color: c.textMuted }}>{t('jql.loading')}</div>
                  ) : transitionError ? (
                    <div className="p-3 text-xs" style={{ color: '#f29096', background: 'rgba(242,144,150,0.15)' }}>{transitionError}</div>
                  ) : transitions.length === 0 ? (
                    <div className="p-3 text-xs" style={{ color: c.textMuted }}>No transitions available</div>
                  ) : (
                    transitions.map((tr) => (
                      <button
                        key={tr.id}
                        className="w-full px-3 py-2 text-left text-sm flex items-center justify-between gap-2"
                        style={{
                          color: tr.to.name === 'Done' ? '#6dd49e' : tr.to.name === 'In Progress' ? '#a494f5' : c.textPrimary,
                          background: 'transparent',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = c.accentBg; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                        onClick={() => handleTransitionSelect(tr)}
                      >
                        <span>{tr.name}</span>
                        <span className="text-xs" style={{ color: c.textMuted }}>→ {tr.to.name}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Assignee + Reporter + Sprint */}
            <div className="grid grid-cols-3 gap-4 mb-5">
              <ValueLabel label={t('dialog.assignee')} c={c}>
                {editMode ? (
                  isFieldEditable('assignee') ? (
                    <EditInput value={getInitialValue('assignee', f.assignee?.displayName || '')} onChange={(v) => handleEdit('assignee', v)} textPrimary={c.textPrimary} borderColor={c.chipBorder} theme={isLight ? 'light' : 'dark'} />
                  ) : (
                    <ChipComp>
                      {getAvatarUrl(f.assignee) && (
                        <img src={getAvatarUrl(f.assignee)} alt="" className="w-4 h-4 rounded-full" />
                      )}
                      <span className="ml-0.5">{getAssigneeName(f.assignee)}</span>
                    </ChipComp>
                  )
                ) : (
                  <ChipComp>
                    {getAvatarUrl(f.assignee) && (
                      <img src={getAvatarUrl(f.assignee)} alt="" className="w-4 h-4 rounded-full" />
                    )}
                    <span className="ml-0.5">{getAssigneeName(f.assignee)}</span>
                  </ChipComp>
                )}
              </ValueLabel>
              <ValueLabel label={t('dialog.reporter')} c={c}>
                {editMode ? (
                  isFieldEditable('reporter') ? (
                    <EditInput value={getInitialValue('reporter', f.reporter?.displayName || '')} onChange={(v) => handleEdit('reporter', v)} textPrimary={c.textPrimary} borderColor={c.chipBorder} theme={isLight ? 'light' : 'dark'} />
                  ) : (
                  <ChipComp style={{ color: c.accent }}>
                    {getAvatarUrl(f.reporter) && (
                      <img src={getAvatarUrl(f.reporter)} alt="" className="w-4 h-4 rounded-full" />
                    )}
                    <span className="ml-0.5">{getAssigneeName(f.reporter)}</span>
                  </ChipComp>
                  )
                ) : (
                  <ChipComp style={{ color: c.accent }}>
                    {getAvatarUrl(f.reporter) && (
                      <img src={getAvatarUrl(f.reporter)} alt="" className="w-4 h-4 rounded-full" />
                    )}
                    <span className="ml-0.5">{getAssigneeName(f.reporter)}</span>
                  </ChipComp>
                )}
              </ValueLabel>
              <ValueLabel label={t('dialog.sprint')} c={c}>
                {editMode ? (
                  isFieldEditable('sprint') ? (
                    <EditInput value={getInitialValue('sprint', f.sprint?.name || '')} onChange={(v) => handleEdit('sprint', v)} textPrimary={c.textPrimary} borderColor={c.chipBorder} theme={isLight ? 'light' : 'dark'} />
                  ) : (
                    <ChipComp>{f.sprint?.name || '-'}</ChipComp>
                  )
                ) : (
                  <ChipComp>{f.sprint?.name || '-'}</ChipComp>
                )}
              </ValueLabel>
            </div>

            {/* Time tracking */}
            <div className="grid grid-cols-3 gap-4 mb-5">
              <ValueLabel label={t('dialog.timeoriginalestimate')} c={c}>
                {editMode ? (
                  isFieldEditable('timeoriginalestimate') ? (
                    <EditInput value={getInitialValue('timeoriginalestimate', formatTime(f.timeoriginalestimate ? parseInt(f.timeoriginalestimate) : null))} onChange={(v) => handleEdit('timeoriginalestimate', v)} textPrimary={c.textPrimary} borderColor={c.chipBorder} theme={isLight ? 'light' : 'dark'} />
                  ) : (
                    <ChipComp>{formatTime(f.timeoriginalestimate ? parseInt(f.timeoriginalestimate) : null)}</ChipComp>
                  )
                ) : (
                  <ChipComp>{formatTime(f.timeoriginalestimate ? parseInt(f.timeoriginalestimate) : null)}</ChipComp>
                )}
              </ValueLabel>
              <ValueLabel label={t('dialog.timeestimate')} c={c}>
                {editMode ? (
                  isFieldEditable('timeestimate') ? (
                    <EditInput value={getInitialValue('timeestimate', formatTime(f.timeestimate ? parseInt(f.timeestimate) : null))} onChange={(v) => handleEdit('timeestimate', v)} textPrimary={c.textPrimary} borderColor={c.chipBorder} theme={isLight ? 'light' : 'dark'} />
                  ) : (
                    <ChipComp style={{ color: c.accent }}>{formatTime(f.timeestimate ? parseInt(f.timeestimate) : null)}</ChipComp>
                  )
                ) : (
                  <ChipComp style={{ color: c.accent }}>{formatTime(f.timeestimate ? parseInt(f.timeestimate) : null)}</ChipComp>
                )}
              </ValueLabel>
              <ValueLabel label={t('dialog.timespent')} c={c}>
                <ChipComp style={{ color: isLight ? '#2da66e' : '#5ec49a' }}>{formatTime(f.timespent ? parseInt(f.timespent) : null)}</ChipComp>
              </ValueLabel>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-3 gap-4 mb-5">
              <ValueLabel label={t('dialog.startDate')} c={c}>
                {editMode ? (
                  isFieldEditable('startDate') ? (
                    <DateTimePickerField
                      value={datetimeValues.startDate}
                      onChange={(v) => setDatetimeValues(prev => ({ ...prev, startDate: v }))}
                      textPrimary={c.textPrimary}
                      borderColor={c.chipBorder}
                      theme={isLight ? 'light' : 'dark'}
                    />
                  ) : (
                    <ChipComp>{formatDateTime(f.customfield_10300 || f.startdate)}</ChipComp>
                  )
                ) : (
                  <ChipComp>{formatDateTime(f.customfield_10300 || f.startdate)}</ChipComp>
                )}
              </ValueLabel>
              <ValueLabel label={t('dialog.dueDate')} c={c}>
                {editMode ? (
                  isFieldEditable('dueDate') ? (
                    <DateTimePickerField
                      value={datetimeValues.dueDate}
                      onChange={(v) => setDatetimeValues(prev => ({ ...prev, dueDate: v }))}
                      textPrimary={c.textPrimary}
                      borderColor={c.chipBorder}
                      theme={isLight ? 'light' : 'dark'}
                    />
                  ) : (
                    <ChipComp>{formatDateTime(f.customfield_10302 || f.duedate)}</ChipComp>
                  )
                ) : (
                  <ChipComp>{formatDateTime(f.customfield_10302 || f.duedate)}</ChipComp>
                )}
              </ValueLabel>
              <ValueLabel label={t('dialog.resolutionDate')} c={c}>
                {editMode ? (
                  isFieldEditable('resolutionDate') ? (
                    <DateTimePickerField
                      value={datetimeValues.resolutionDate}
                      onChange={(v) => setDatetimeValues(prev => ({ ...prev, resolutionDate: v }))}
                      textPrimary={c.textPrimary}
                      borderColor={c.chipBorder}
                      theme={isLight ? 'light' : 'dark'}
                    />
                  ) : (
                    <ChipComp>{formatDateTime(f.resolutiondate)}</ChipComp>
                  )
                ) : (
                  <ChipComp>{formatDateTime(f.resolutiondate)}</ChipComp>
                )}
              </ValueLabel>
            </div>

            {/* Description */}
            <div className="mb-5">
              <ValueLabel label={t('dialog.description')} c={c}>
                {editMode ? (
                  isFieldEditable('description') ? (
                    <EditTextArea
                      value={getInitialValue('description', f.description || '')}
                      onChange={(v) => handleEdit('description', v)}
                      textPrimary={c.textPrimary}
                      borderColor={c.chipBorder}
                      placeholder={getDescriptionPlaceholder(getInitialValue('description', f.description || ''), language)}
                      theme={isLight ? 'light' : 'dark'}
                    />
                  ) : (
                    <div
                      className="text-xs leading-relaxed whitespace-pre-wrap rounded-xl px-4 py-3"
                      style={{
                        background: c.cardBgInner,
                        border: `1px solid ${c.border}`,
                        color: c.textSecondary,
                      }}
                    >
                      {f.description || (isLight ? 'No description' : 'Không có mô tả')}
                    </div>
                  )
                ) : (
                  <div
                    className="text-xs leading-relaxed whitespace-pre-wrap rounded-xl px-4 py-3"
                    style={{
                      background: c.cardBgInner,
                      border: `1px solid ${c.border}`,
                      color: c.textSecondary,
                    }}
                  >
                    {f.description || (isLight ? 'No description' : 'Không có mô tả')}
                  </div>
                )}
              </ValueLabel>
            </div>

            {/* Epic + Parent */}
            {(f.epic || f.parent) && (
              <div className="grid grid-cols-2 gap-4 mb-5">
                {f.epic && (
                  <ValueLabel label={t('dialog.epic')} c={c}>
                    {editMode ? (
                      isFieldEditable('epic') ? (
                        <EditInput value={getInitialValue('epic', f.epic.key)} onChange={(v) => handleEdit('epic', v)} textPrimary={c.textPrimary} borderColor={c.chipBorder} theme={isLight ? 'light' : 'dark'} />
                      ) : (
                        <ChipComp>
                          <a href={`${baseUrl}/browse/${f.epic.key}`} target="_blank" rel="noopener noreferrer" className="hover:underline font-mono font-semibold" style={{ color: c.accent }}>
                            {f.epic.key}
                          </a>
                          <span className="ml-1.5">{f.epic.fields.name}</span>
                        </ChipComp>
                      )
                    ) : (
                      <ChipComp>
                        <a href={`${baseUrl}/browse/${f.epic.key}`} target="_blank" rel="noopener noreferrer" className="hover:underline font-mono font-semibold" style={{ color: c.accent }}>
                          {f.epic.key}
                        </a>
                        <span className="ml-1.5">{f.epic.fields.name}</span>
                      </ChipComp>
                    )}
                  </ValueLabel>
                )}
                {f.parent && (
                  <ValueLabel label={t('dialog.parent')} c={c}>
                    {editMode ? (
                      isFieldEditable('parent') ? (
                        <EditInput value={getInitialValue('parent', f.parent.key)} onChange={(v) => handleEdit('parent', v)} textPrimary={c.textPrimary} borderColor={c.chipBorder} theme={isLight ? 'light' : 'dark'} />
                      ) : (
                        <ChipComp>
                          <a href={`${baseUrl}/browse/${f.parent.key}`} target="_blank" rel="noopener noreferrer" className="hover:underline font-mono font-semibold" style={{ color: c.accent }}>
                            {f.parent.key}
                          </a>
                          <span className="ml-1.5">{f.parent.fields.summary}</span>
                        </ChipComp>
                      )
                    ) : (
                      <ChipComp>
                        <a href={`${baseUrl}/browse/${f.parent.key}`} target="_blank" rel="noopener noreferrer" className="hover:underline font-mono font-semibold" style={{ color: c.accent }}>
                          {f.parent.key}
                        </a>
                        <span className="ml-1.5">{f.parent.fields.summary}</span>
                      </ChipComp>
                    )}
                  </ValueLabel>
                )}
              </div>
            )}

            {/* Labels */}
            {f.labels && f.labels.length > 0 && (
              <div className="mb-5">
                  <ValueLabel label={t('dialog.labels')} c={c}>
                    {editMode ? (
                      isFieldEditable('labels') ? (
                        <EditInput value={getInitialValue('labels', f.labels.join(', '))} onChange={(v) => handleEdit('labels', v)} textPrimary={c.textPrimary} borderColor={c.chipBorder} theme={isLight ? 'light' : 'dark'} />
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {f.labels.map((label) => (
                            <ChipComp key={label} style={{
                              background: isLight ? 'rgba(99,102,241,0.06)' : 'rgba(160,148,232,0.08)',
                              color: c.chipText,
                              borderColor: isLight ? 'rgba(99,102,241,0.15)' : 'rgba(160,148,232,0.15)',
                            }}>
                              {label}
                            </ChipComp>
                          ))}
                        </div>
                      )
                    ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {f.labels.map((label) => (
                        <ChipComp key={label} style={{
                          background: isLight ? 'rgba(99,102,241,0.06)' : 'rgba(160,148,232,0.08)',
                          color: c.chipText,
                          borderColor: isLight ? 'rgba(99,102,241,0.15)' : 'rgba(160,148,232,0.15)',
                        }}>
                          {label}
                        </ChipComp>
                      ))}
                    </div>
                  )}
                </ValueLabel>
              </div>
            )}

            {/* Resolution */}
            {f.resolution && (
              <div className="mb-5">
                <ValueLabel label={t('dialog.resolution')} c={c}>
                  {editMode ? (
                    isFieldEditable('resolution') ? (
                      <EditInput value={getInitialValue('resolution', f.resolution.name)} onChange={(v) => handleEdit('resolution', v)} textPrimary={c.textPrimary} borderColor={c.chipBorder} theme={isLight ? 'light' : 'dark'} />
                    ) : (
                      <ChipComp>{f.resolution.name}</ChipComp>
                    )
                  ) : (
                    <ChipComp>{f.resolution.name}</ChipComp>
                  )}
                </ValueLabel>
              </div>
            )}

            {/* Created + Updated */}
            <div className="grid grid-cols-2 gap-4 pt-4" style={{ borderTop: `1px solid ${c.borderRow}` }}>
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wider mb-1.5" style={{ color: c.textMuted }}>{t('dialog.created')}</div>
                <ChipComp>{formatDateTime(f.created)}</ChipComp>
              </div>
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wider mb-1.5" style={{ color: c.textMuted }}>{t('dialog.updated')}</div>
                <ChipComp>{formatDateTime(f.updated)}</ChipComp>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Transition confirmation modal */}
      {selectedTransition && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          onMouseDown={(e) => { if (e.target === e.currentTarget) { setSelectedTransition(null); setTransitionFieldsData({}); setFieldValues({}); } }}
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
        >
          <div
            className="w-full max-w-lg rounded-2xl flex flex-col"
            style={{
              background: c.cardBg,
              WebkitBackdropFilter: 'blur(32px) saturate(1.6)',
              backdropFilter: 'blur(32px) saturate(1.6)',
              border: `1px solid ${c.border}`,
              boxShadow: '0 16px 64px rgba(0,0,0,0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: c.borderRow }}>
              <h3 className="text-base font-bold" style={{ color: c.textPrimary }}>{t('dialog.confirmTransition')}</h3>
              <button
                onClick={() => { setSelectedTransition(null); setTransitionFieldsData({}); setFieldValues({}); }}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-sm"
                style={{ color: c.textMuted, background: 'rgba(255,255,255,0.06)' }}
              >
                ✕
              </button>
            </div>

            <div className="flex flex-1 overflow-y-auto px-6 py-5">
              <div className="w-full">
                {/* Transition info */}
                <div className="mb-5 p-3 rounded-xl" style={{ background: c.cardBgInner, border: `1px solid ${c.border}` }}>
                  <div className="text-xs" style={{ color: c.textMuted }}>
                    <span style={{ color: statusText?.text || c.chipText }}>{f.status.name}</span>
                    <span style={{ color: c.textMuted }}> → </span>
                    <span style={{ color: '#6dd49e' }}>{selectedTransition.to.name}</span>
                  </div>
                  <div className="text-xs mt-1" style={{ color: c.textMuted }}>Transition: {selectedTransition.name}</div>
                </div>

                {transitionFormFields.length > 0 && (
                  <div className="mb-4">
                    <div className="text-[11px] font-medium uppercase tracking-wider mb-3" style={{ color: c.textMuted }}>
                      {t('dialog.transitionField')}
                    </div>
                    <div className="space-y-4">
                      {transitionFormFields.map(([fieldId, fieldDef]) => (
                        <div key={fieldId}>
                          <label className="text-xs font-medium mb-1.5 block" style={{ color: c.textSecondary }}>
                            {fieldDef.name || fieldId}
                            {fieldDef.required && <span style={{ color: '#f29096' }}> *</span>}
                          </label>

                          {fieldDef.schema?.type === 'resolution' && fieldDef.allowedValues?.length ? (
                            <select
                              value={fieldValues[fieldId] || ''}
                              onChange={(e) => updateField(fieldId, e.target.value)}
                              className="px-3 py-1.5 rounded-xl text-sm w-full"
                              style={{
                                background: 'rgba(160,148,232,0.1)',
                                border: '1px solid rgba(160,148,232,0.3)',
                                color: c.textPrimary,
                                outline: 'none',
                              }}
                            >
                              <option value="">-- Select --</option>
                              {fieldDef.allowedValues.map((r) => (
                                <option key={r.id} value={r.name}>{r.name}</option>
                              ))}
                            </select>
                          ) : fieldId === 'customfield_10300' ? (
                            <input
                              type="text"
                              value={fieldValues[fieldId] || ''}
                              onChange={(e) => updateField(fieldId, e.target.value)}
                              placeholder="dd/mm/yyyy hh:mm"
                              className="px-3 py-1.5 rounded-xl text-sm w-full"
                              style={{
                                background: 'rgba(160,148,232,0.1)',
                                border: '1px solid rgba(160,148,232,0.3)',
                                color: c.textPrimary,
                                outline: 'none',
                              }}
                            />
                          ) : fieldId === 'customfield_10302' ? (
                            <input
                              type="text"
                              value={fieldValues[fieldId] || ''}
                              onChange={(e) => updateField(fieldId, e.target.value)}
                              placeholder="dd/mm/yyyy hh:mm"
                              className="px-3 py-1.5 rounded-xl text-sm w-full"
                              style={{
                                background: 'rgba(160,148,232,0.1)',
                                border: '1px solid rgba(160,148,232,0.3)',
                                color: c.textPrimary,
                                outline: 'none',
                              }}
                            />
                          ) : fieldId === 'customfield_10304' ? (
                            <textarea
                              value={fieldValues[fieldId] || ''}
                              onChange={(e) => updateField(fieldId, e.target.value)}
                              placeholder="Enter output..."
                              className="px-3 py-1.5 rounded-xl text-sm w-full resize-none"
                              rows={3}
                              style={{
                                background: 'rgba(160,148,232,0.1)',
                                border: '1px solid rgba(160,148,232,0.3)',
                                color: c.textPrimary,
                                outline: 'none',
                              }}
                            />
                          ) : fieldId === 'timetracking' ? (
                            <input
                              type="text"
                              value={fieldValues[fieldId] || ''}
                              onChange={(e) => updateField(fieldId, e.target.value)}
                              placeholder="1d 2h 30m"
                              className="px-3 py-1.5 rounded-xl text-sm w-full"
                              style={{
                                background: 'rgba(160,148,232,0.1)',
                                border: '1px solid rgba(160,148,232,0.3)',
                                color: c.textPrimary,
                                outline: 'none',
                              }}
                            />
                          ) : (
                            <input
                              type="text"
                              value={fieldValues[fieldId] || ''}
                              onChange={(e) => updateField(fieldId, e.target.value)}
                              className="px-3 py-1.5 rounded-xl text-sm w-full"
                              style={{
                                background: 'rgba(160,148,232,0.1)',
                                border: '1px solid rgba(160,148,232,0.3)',
                                color: c.textPrimary,
                                outline: 'none',
                              }}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {transitionError && (
                  <div className="p-3 rounded-lg text-xs mb-4" style={{ background: 'rgba(242,144,150,0.15)', color: '#f29096', border: '1px solid rgba(242,144,150,0.3)' }}>
                    {transitionError}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t shrink-0" style={{ borderColor: c.borderRow }}>
              <button
                onClick={() => { setSelectedTransition(null); setTransitionFieldsData({}); setFieldValues({}); }}
                className="px-4 py-2 text-sm rounded-xl"
                style={{ color: c.textMuted, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleTransitionSubmit}
                disabled={transitioning}
                className="px-6 py-2 text-sm rounded-xl font-medium"
                style={{
                  color: '#6dd49e',
                  background: 'rgba(109,212,158,0.15)',
                  border: '1px solid rgba(109,212,158,0.35)',
                  cursor: transitioning ? 'not-allowed' : 'pointer',
                }}
              >
                {transitioning ? t('dialog.transitioning') : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
