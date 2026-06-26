'use client';

import { MouseEvent, useState, useCallback } from 'react';
import { DashboardIssue, JiraIssue } from '@/types/jira';
import { useLanguage } from '@/lib/i18n';

interface JiraTableProps {
  data: DashboardIssue[];
  onPageChange: (page: number) => void;
  initialVisibleColumns?: readonly SortField[];
  columnLabels?: Partial<Record<SortField, string>>;
  onTaskClick?: (issue: JiraIssue) => void;
  fullIssues?: Record<string, JiraIssue>;
}

type SortField = Exclude<keyof DashboardIssue, 'id'>;
type SortOrder = 'asc' | 'desc';

const VISIBLE_COLUMNS = ['key', 'summary', 'status', 'assignee', 'priority', 'issuetype', 'estimated', 'originalEstimate', 'logged', 'startDate', 'dueDate', 'resolutionDate', 'created', 'updated', 'sprint', 'epic', 'resolution', 'labels'] as const;

const DEFAULT_COLUMN_WIDTHS: Record<(typeof VISIBLE_COLUMNS)[number], number> = {
  key: 140,
  summary: 300,
  status: 120,
  assignee: 150,
  priority: 110,
  issuetype: 130,
  estimated: 110,
  originalEstimate: 75,
  logged: 110,
  startDate: 145,
  dueDate: 145,
  resolutionDate: 165,
  created: 120,
  updated: 120,
  sprint: 140,
  epic: 140,
  resolution: 130,
  labels: 180,
};

const MIN_COLUMN_WIDTH = 72;

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

const COLUMN_LABEL_KEYS: Record<SortField, Parameters<ReturnType<typeof useLanguage>['t']>[0]> = {
  key: 'table.column.key',
  summary: 'table.column.summary',
  status: 'table.column.status',
  assignee: 'table.column.assignee',
  priority: 'table.column.priority',
  issuetype: 'table.column.issuetype',
  estimated: 'table.column.estimated',
  originalEstimate: 'table.column.originalEstimate',
  logged: 'table.column.logged',
  startDate: 'table.column.startDate',
  dueDate: 'table.column.dueDate',
  resolutionDate: 'table.column.resolutionDate',
  created: 'table.column.created',
  updated: 'table.column.updated',
  sprint: 'table.column.sprint',
  epic: 'table.column.epic',
  resolution: 'table.column.resolution',
  labels: 'table.column.labels',
};

export default function JiraTable({ data, onPageChange, initialVisibleColumns, columnLabels, onTaskClick, fullIssues }: JiraTableProps) {
  const { t } = useLanguage();
  const baseUrl = process.env.NEXT_PUBLIC_JIRA_BASE_URL || 'https://your-domain.atlassian.net';
  const handleTaskClick = useCallback((key: string) => {
    if (onTaskClick && fullIssues?.[key]) {
      onTaskClick(fullIssues[key]);
    }
  }, [onTaskClick, fullIssues]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortField, setSortField] = useState<SortField>('key');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [selectedColumns, setSelectedColumns] = useState<Set<SortField>>(
    new Set(initialVisibleColumns || VISIBLE_COLUMNS)
  );
  const [columnWidths, setColumnWidths] = useState<Record<SortField, number>>(DEFAULT_COLUMN_WIDTHS);

  const toggleColumn = (field: SortField) => {
    setSelectedColumns((prev) => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  };

  const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const handlePageSizeChange = (nextPageSize: number) => {
    setPageSize(nextPageSize);
    setCurrentPage(1);
    onPageChange(1);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const sortedData = [...data].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];
    if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const paginatedData = sortedData.slice(
    (safeCurrentPage - 1) * pageSize,
    safeCurrentPage * pageSize
  );

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <span className="ml-0.5 opacity-30">↕</span>;
    return <span className="ml-0.5">{sortOrder === 'asc' ? '↑' : '↓'}</span>;
  };

  const visibleColumns = VISIBLE_COLUMNS.filter((c) => selectedColumns.has(c));
  const totalTableWidth = visibleColumns.reduce((sum, col) => sum + columnWidths[col], 0);

  const getColumnStyle = (col: SortField) => ({
    width: columnWidths[col],
    minWidth: columnWidths[col],
  });

  const startColumnResize = (event: MouseEvent<HTMLSpanElement>, col: SortField) => {
    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;
    const startWidth = columnWidths[col];

    const handleMouseMove = (moveEvent: globalThis.MouseEvent) => {
      const nextWidth = Math.max(MIN_COLUMN_WIDTH, startWidth + moveEvent.clientX - startX);
      setColumnWidths((prev) => ({ ...prev, [col]: nextWidth }));
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const renderHeaderCell = (col: SortField) => (
    <th
      key={col}
      className="px-4 py-2.5 cursor-pointer hover:text-[var(--text-secondary)] select-none whitespace-nowrap relative group"
      onClick={() => handleSort(col)}
      style={getColumnStyle(col)}
    >
      <div className="flex items-center overflow-hidden">
        <span className="truncate">{columnLabels?.[col] || t(COLUMN_LABEL_KEYS[col])}</span>
        <SortIcon field={col} />
      </div>
      <span
        aria-hidden="true"
        className="absolute top-0 right-0 h-full w-2 cursor-col-resize touch-none opacity-0 group-hover:opacity-100"
        style={{ borderRight: '2px solid var(--accent-border)' }}
        onClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => startColumnResize(event, col)}
      />
    </th>
  );

  const renderBodyCell = (col: SortField, issue: DashboardIssue): React.ReactNode => {
    switch (col) {
      case 'key':
        return (
          <td key={`td-${issue.id}-${col}`} className="px-4 py-2.5 text-xs font-mono font-semibold text-[var(--accent)]">
            {fullIssues && fullIssues[issue.key] ? (
              <span
                className="cursor-pointer hover:underline inline-flex items-center gap-1"
                onClick={(e) => {
                  if (e.ctrlKey || e.metaKey || e.shiftKey) return;
                  e.preventDefault();
                  e.stopPropagation();
                  handleTaskClick(issue.key);
                }}
                onAuxClick={(e) => {
                  if (e.button === 1) {
                    e.preventDefault();
                    handleTaskClick(issue.key);
                  }
                }}
              >
                {issue.key}
                <svg className="w-3 h-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </span>
            ) : (
              <a href={`${baseUrl}/browse/${issue.key}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
                {issue.key}
              </a>
            )}
          </td>
        );
      case 'summary':
        return <td key={`td-${issue.id}-${col}`} className="px-4 py-2.5 text-xs text-[var(--text-primary)] max-w-xs truncate">{issue.summary}</td>;
      case 'status':
        return (
          <td key={`td-${issue.id}-${col}`} className="px-4 py-2.5">
            <span className="badge-glass" style={{
              background: STATUS_MAP[issue.status]?.bg || 'rgba(141,145,156,0.08)',
              color: STATUS_MAP[issue.status]?.text || '#8d919c',
              borderColor: STATUS_MAP[issue.status]?.border || 'rgba(141,145,156,0.12)',
            }}>
              {issue.status}
            </span>
          </td>
        );
      case 'assignee':
        return <td key={`td-${issue.id}-${col}`} className="px-4 py-2.5 text-xs text-[var(--text-secondary)]">{issue.assignee || '-'}</td>;
      case 'priority':
        return (
          <td key={`td-${issue.id}-${col}`} className="px-4 py-2.5">
            <span className="badge-glass" style={{
              background: PRIORITY_MAP[issue.priority]?.bg || 'rgba(82,86,95,0.08)',
              color: PRIORITY_MAP[issue.priority]?.text || '#52565f',
              borderColor: PRIORITY_MAP[issue.priority]?.border || 'rgba(82,86,95,0.12)',
            }}>
              {issue.priority || '-'}
            </span>
          </td>
        );
      case 'issuetype':
        return <td key={`td-${issue.id}-${col}`} className="px-4 py-2.5 text-xs text-[var(--text-muted)]">{issue.issuetype}</td>;
      case 'estimated':
        return <td key={`td-${issue.id}-${col}`} className="px-4 py-2.5 text-xs font-mono text-[var(--accent)]">{issue.estimated || '0h'}</td>;
      case 'originalEstimate':
        return <td key={`td-${issue.id}-${col}`} className="px-4 py-2.5 text-xs font-mono text-[var(--text-secondary)]">{issue.originalEstimate || '0h'}</td>;
      case 'logged':
        return <td key={`td-${issue.id}-${col}`} className="px-4 py-2.5 text-xs font-mono text-[var(--success)]">{issue.logged || '0h'}</td>;
      case 'startDate':
        return <td key={`td-${issue.id}-${col}`} className="px-4 py-2.5 text-xs text-[var(--text-muted)]">{issue.startDate || '-'}</td>;
      case 'dueDate':
        return <td key={`td-${issue.id}-${col}`} className="px-4 py-2.5 text-xs text-[var(--text-muted)]">{issue.dueDate || '-'}</td>;
      case 'resolutionDate':
        return <td key={`td-${issue.id}-${col}`} className="px-4 py-2.5 text-xs text-[var(--text-muted)]">{issue.resolutionDate || '-'}</td>;
      case 'created':
        return <td key={`td-${issue.id}-${col}`} className="px-4 py-2.5 text-xs text-[var(--text-muted)]">{issue.created || '-'}</td>;
      case 'updated':
        return <td key={`td-${issue.id}-${col}`} className="px-4 py-2.5 text-xs text-[var(--text-muted)]">{issue.updated || '-'}</td>;
      case 'sprint':
        return <td key={`td-${issue.id}-${col}`} className="px-4 py-2.5 text-xs text-[var(--text-muted)]">{issue.sprint || '-'}</td>;
      case 'epic':
        return <td key={`td-${issue.id}-${col}`} className="px-4 py-2.5 text-xs text-[var(--text-muted)]">{issue.epic || '-'}</td>;
      case 'resolution':
        return <td key={`td-${issue.id}-${col}`} className="px-4 py-2.5 text-xs text-[var(--text-muted)]">{issue.resolution || '-'}</td>;
      case 'labels':
        return (
          <td key={`td-${issue.id}-${col}`} className="px-4 py-2.5">
            <div className="flex flex-wrap gap-1.5">
              {(issue.labels || []).slice(0, 3).map((label) => (
                <span key={label} className="badge-glass" style={{
                  background: 'rgba(160,148,232,0.08)',
                  color: 'var(--text-dim)',
                  borderColor: 'rgba(160,148,232,0.15)',
                  fontSize: '10px',
                  padding: '2px 7px',
                }}>
                  {label}
                </span>
              ))}
              {issue.labels && issue.labels.length > 3 && (
                <span className="text-[10px] text-[var(--text-muted)]">+{issue.labels.length - 3}</span>
              )}
            </div>
          </td>
        );
      default:
        return null;
    }
  };

  return (
    <div className="table-wrap">
      <div className="p-2.5 flex flex-wrap gap-1.5 items-center" style={{ borderBottom: '1px solid var(--border)' }}>
        <span className="text-xs font-medium text-[var(--text-muted)]">{t('table.columns')}</span>
        {VISIBLE_COLUMNS.map((col) => (
          <button
            key={col}
            onClick={() => toggleColumn(col)}
            className={`col-btn ${selectedColumns.has(col) ? 'active-col' : ''}`}
            style={{
              color: selectedColumns.has(col) ? 'var(--accent)' : 'var(--text-muted)',
              background: selectedColumns.has(col) ? 'var(--accent-bg)' : 'var(--surface-light)',
            }}
          >
            {columnLabels?.[col] || t(COLUMN_LABEL_KEYS[col])}
          </button>
        ))}
      </div>

      <div className="overflow-auto" style={{ maxHeight: '100%', flex: 1 }}>
        <table className="table-fixed" style={{ width: totalTableWidth }}>
          <colgroup>
            {visibleColumns.map((col) => (
              <col key={`col-${col}`} style={getColumnStyle(col)} />
            ))}
          </colgroup>
          <thead>
            <tr className="text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
              {visibleColumns.map(renderHeaderCell)}
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((issue) => (
              <tr key={issue.id}>
                {visibleColumns.map(col => renderBodyCell(col, issue))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.length === 0 && (
        <div className="text-center py-12 text-[var(--text-muted)] text-sm">
          {t('table.empty')}
        </div>
      )}

      {data.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--text-muted)]">
            <span>{((safeCurrentPage - 1) * pageSize) + 1}–{Math.min(safeCurrentPage * pageSize, data.length)} / {data.length}</span>
            <label className="flex items-center gap-1.5">
              <span>{t('table.rowsPerPage')}</span>
              <select
                value={pageSize}
                onChange={(event) => handlePageSizeChange(Number(event.target.value))}
                className="page-size-select"
              >
                {[10, 20, 50, 100].map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => { setCurrentPage(1); onPageChange(1); }}
              disabled={safeCurrentPage === 1}
              style={{
                color: 'var(--text-secondary)',
                opacity: safeCurrentPage === 1 ? 0.35 : 1,
                cursor: safeCurrentPage === 1 ? 'not-allowed' : 'pointer',
                filter: safeCurrentPage === 1 ? 'grayscale(0.5)' : 'none',
              }}
              className="page-btn"
            >
              {t('table.first')}
            </button>
            <button
              onClick={() => { setCurrentPage(p => Math.max(1, p - 1)); onPageChange(safeCurrentPage - 1); }}
              disabled={safeCurrentPage === 1}
              className="page-btn"
              style={{ color: 'var(--text-secondary)', opacity: safeCurrentPage === 1 ? 0.35 : 1, cursor: safeCurrentPage === 1 ? 'not-allowed' : 'pointer', filter: safeCurrentPage === 1 ? 'grayscale(0.5)' : 'none' }}
            >
              {t('table.prev')}
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(page => {
                if (totalPages <= 7) return true;
                if (page === 1 || page === totalPages) return true;
                if (Math.abs(page - safeCurrentPage) <= 1) return true;
                return false;
              })
              .map((page, idx, arr) => (
                <div key={page}>
                  {idx > 0 && arr[idx - 1] !== page - 1 && <span className="px-1 text-[var(--text-muted)] text-xs">...</span>}
                  <button
                    onClick={() => { setCurrentPage(page); onPageChange(page); }}
                    className={`page-btn ${safeCurrentPage === page ? 'active-page' : ''}`}
                    style={safeCurrentPage === page ? {} : { color: 'var(--text-secondary)' }}
                  >
                    {page}
                  </button>
                </div>
              ))}
            <button
              onClick={() => { setCurrentPage(p => Math.min(totalPages, p + 1)); onPageChange(safeCurrentPage + 1); }}
              disabled={safeCurrentPage === totalPages}
              className="page-btn"
              style={{ color: 'var(--text-secondary)', opacity: safeCurrentPage === totalPages ? 0.35 : 1, cursor: safeCurrentPage === totalPages ? 'not-allowed' : 'pointer', filter: safeCurrentPage === totalPages ? 'grayscale(0.5)' : 'none' }}
            >
              {t('table.next')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}









