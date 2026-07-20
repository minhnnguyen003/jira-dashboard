'use client';

import { useCallback, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLanguage } from '@/lib/i18n';
import {
  chooseAssigneeInputState,
  createAssigneeInputSnapshot,
  createAssigneeInputState,
  editAssigneeInputState,
  filterAssigneeUsers,
  reconcileAssigneeInputState,
  resolveAssigneeInput,
  runAssigneeBlurIfCurrent,
} from './assigneeComboboxHelpers.js';

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

function AssigneeComboboxInput({ users, value, loading, error, onChange, selected }: InputProps) {
  const { t } = useLanguage();
  const listboxId = useId();
  const selectedIdentity = selected ? selected.email || selected.name : '';
  const selectedDisplayName = selected?.displayName || '';
  const externalSnapshot = createAssigneeInputSnapshot(value, selected);
  const [inputState, setInputState] = useState(() => createAssigneeInputState(externalSnapshot));
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const blurTimeout = useRef<number | null>(null);
  const blurGeneration = useRef(0);
  const reconciledInputState = reconcileAssigneeInputState(inputState, externalSnapshot);
  if (reconciledInputState !== inputState) {
    setInputState(reconciledInputState);
  }
  const visibleQuery = reconciledInputState.query;
  const filtered = useMemo<AssigneeOption[]>(
    () => filterAssigneeUsers(users, visibleQuery) as AssigneeOption[],
    [users, visibleQuery],
  );
  const available = loading || error ? [] : filtered;
  const hasOptions = open && available.length > 0;
  const activeOption = hasOptions ? available[highlighted] : undefined;

  const invalidatePendingBlur = useCallback(() => {
    blurGeneration.current += 1;
    if (blurTimeout.current !== null) {
      window.clearTimeout(blurTimeout.current);
      blurTimeout.current = null;
    }
  }, []);

  useLayoutEffect(() => {
    invalidatePendingBlur();
    return invalidatePendingBlur;
  }, [invalidatePendingBlur, value, selectedIdentity, selectedDisplayName]);

  const choose = (user: AssigneeOption | null) => {
    invalidatePendingBlur();
    const nextInputState = chooseAssigneeInputState(user);
    setInputState(nextInputState);
    setOpen(false);
    onChange(nextInputState.snapshot.value);
  };

  const handleBlur = () => {
    invalidatePendingBlur();
    const scheduledGeneration = blurGeneration.current;
    blurTimeout.current = window.setTimeout(() => {
      runAssigneeBlurIfCurrent(scheduledGeneration, blurGeneration.current, () => {
        blurTimeout.current = null;
        const exact = resolveAssigneeInput(users, visibleQuery);
        choose(exact);
      });
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
      invalidatePendingBlur();
      setOpen(false);
      setInputState(createAssigneeInputState(externalSnapshot));
    }
  };

  return (
    <div className="relative">
      <input
        role="combobox"
        aria-label={t('browseTasks.tab.assignee')}
        aria-autocomplete="list"
        aria-expanded={hasOptions}
        aria-controls={hasOptions ? listboxId : undefined}
        aria-activedescendant={activeOption ? `${listboxId}-${highlighted}` : undefined}
        value={visibleQuery}
        placeholder={t('browseTasks.assigneePlaceholder')}
        className="input-field w-full px-3 py-2 text-sm"
        onFocus={() => {
          invalidatePendingBlur();
          setOpen(true);
        }}
        onChange={(event) => {
          const nextQuery = event.target.value;
          invalidatePendingBlur();
          setInputState(editAssigneeInputState(externalSnapshot, nextQuery));
          setHighlighted(0);
          setOpen(true);
          if (!nextQuery) onChange('');
        }}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
      />

      {open && loading && (
        <div
          role="status"
          aria-live="polite"
          className="absolute z-50 mt-1 w-full rounded-xl px-3 py-2 text-sm"
          style={{ background: 'var(--dropdown-bg)', border: '1px solid var(--border)' }}
        >
          {t('browseTasks.assigneeLoading')}
        </div>
      )}

      {open && !loading && error && (
        <div
          role="alert"
          aria-live="assertive"
          className="absolute z-50 mt-1 w-full rounded-xl px-3 py-2 text-sm"
          style={{ background: 'var(--dropdown-bg)', border: '1px solid var(--border)' }}
        >
          {t('browseTasks.assigneeError')}
        </div>
      )}

      {open && !loading && !error && filtered.length === 0 && (
        <div
          role="status"
          aria-live="polite"
          className="absolute z-50 mt-1 w-full rounded-xl px-3 py-2 text-sm"
          style={{ background: 'var(--dropdown-bg)', border: '1px solid var(--border)' }}
        >
          {t('browseTasks.assigneeEmpty')}
        </div>
      )}

      {hasOptions && (
        <div
          id={listboxId}
          role="listbox"
          aria-label={t('browseTasks.tab.assignee')}
          className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-xl p-1"
          style={{ background: 'var(--dropdown-bg)', border: '1px solid var(--border)' }}
        >
          {filtered.map((user, index) => (
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
                if (event.button === 0) event.preventDefault();
              }}
              onClick={() => choose(user)}
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

  return <AssigneeComboboxInput {...props} selected={selected} />;
}
