'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useLanguage } from '@/lib/i18n';
import { filterAssigneeUsers, resolveAssigneeInput } from './assigneeComboboxHelpers.js';

export interface AssigneeOption {
  name: string;
  displayName: string;
  email: string;
  avatarUrl?: string;
}

interface Props {
  users: AssigneeOption[];
  value: string;
  loading: boolean;
  error: boolean;
  onChange: (value: string) => void;
}

interface InputProps extends Props {
  selected: AssigneeOption | null;
}

function AssigneeComboboxInput({ users, loading, error, onChange, selected }: InputProps) {
  const { t } = useLanguage();
  const listboxId = useId();
  const [query, setQuery] = useState(selected?.displayName || '');
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const blurTimeout = useRef<number | null>(null);
  const filtered = useMemo<AssigneeOption[]>(
    () => filterAssigneeUsers(users, query) as AssigneeOption[],
    [users, query],
  );
  const available = loading || error ? [] : filtered;
  const activeOption = open ? available[highlighted] : undefined;

  useEffect(() => () => {
    if (blurTimeout.current !== null) window.clearTimeout(blurTimeout.current);
  }, []);

  const choose = (user: AssigneeOption | null) => {
    if (blurTimeout.current !== null) {
      window.clearTimeout(blurTimeout.current);
      blurTimeout.current = null;
    }
    onChange(user ? user.email || user.name : '');
    setQuery(user?.displayName || '');
    setOpen(false);
  };

  const handleBlur = () => {
    blurTimeout.current = window.setTimeout(() => {
      blurTimeout.current = null;
      const exact = resolveAssigneeInput(users, query);
      choose(exact);
    }, 0);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      setHighlighted((current) => (
        available.length ? (current + delta + available.length) % available.length : 0
      ));
    } else if (event.key === 'Enter' && open && available[highlighted]) {
      event.preventDefault();
      choose(available[highlighted]);
    } else if (event.key === 'Escape') {
      setOpen(false);
      setQuery(selected?.displayName || '');
    }
  };

  return (
    <div className="relative">
      <input
        role="combobox"
        aria-label={t('browseTasks.tab.assignee')}
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={activeOption ? `${listboxId}-${highlighted}` : undefined}
        value={query}
        placeholder={t('browseTasks.assigneePlaceholder')}
        className="input-field w-full px-3 py-2 text-sm"
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          const nextQuery = event.target.value;
          setQuery(nextQuery);
          setHighlighted(0);
          setOpen(true);
          if (!nextQuery) onChange('');
        }}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
      />

      {open && (
        <div
          id={listboxId}
          role="listbox"
          aria-label={t('browseTasks.tab.assignee')}
          className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-xl p-1"
          style={{ background: 'var(--dropdown-bg)', border: '1px solid var(--border)' }}
        >
          {loading ? (
            <div role="status" className="px-3 py-2 text-sm">
              {t('browseTasks.assigneeLoading')}
            </div>
          ) : error ? (
            <div role="alert" className="px-3 py-2 text-sm">
              {t('browseTasks.assigneeError')}
            </div>
          ) : filtered.length === 0 ? (
            <div role="status" className="px-3 py-2 text-sm">
              {t('browseTasks.assigneeEmpty')}
            </div>
          ) : filtered.map((user, index) => (
            <button
              id={`${listboxId}-${index}`}
              key={user.email || user.name}
              type="button"
              role="option"
              aria-selected={index === highlighted}
              tabIndex={-1}
              className="flex w-full flex-col rounded-lg px-3 py-2 text-left"
              onMouseEnter={() => setHighlighted(index)}
              onMouseDown={(event) => {
                event.preventDefault();
                choose(user);
              }}
            >
              <span className="text-sm">{user.displayName}</span>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {user.email || user.name}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AssigneeCombobox(props: Props) {
  const selected = props.users.find((user) => (user.email || user.name) === props.value) || null;
  const syncKey = `${props.value}\u0000${selected?.displayName || ''}`;

  return <AssigneeComboboxInput key={syncKey} {...props} selected={selected} />;
}
