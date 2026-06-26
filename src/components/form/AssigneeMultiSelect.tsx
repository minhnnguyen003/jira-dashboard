'use client';

import { useState, useRef, KeyboardEvent } from 'react';
import { useLanguage } from '@/lib/i18n';

interface AssigneeChip {
  email: string;
  displayName: string;
}

interface AssigneeMultiSelectProps {
  value: AssigneeChip[];
  onChange: (chips: AssigneeChip[]) => void;
}

export default function AssigneeMultiSelect({ value, onChange }: AssigneeMultiSelectProps) {
  const { t } = useLanguage();
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const addChip = (text: string) => {
    const trimmed = text.trim().toLowerCase();
    if (!trimmed) return;

    let email: string;
    let displayName: string;

    if (trimmed.includes('@')) {
      email = trimmed;
      displayName = trimmed.split('@')[0];
    } else {
      if (!trimmed.includes('@etc.vn')) {
        email = `${trimmed}@etc.vn`;
        displayName = trimmed;
      } else {
        email = trimmed;
        displayName = trimmed.split('@')[0];
      }
    }

    const exists = value.some((chip) => chip.email === email);
    if (exists) return;

    const chip: AssigneeChip = { email, displayName };
    onChange([...value, chip]);
    setInputValue('');
  };

  const removeChip = (email: string) => {
    onChange(value.filter((chip) => chip.email !== email));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addChip(inputValue);
    } else if (e.key === 'Backspace' && inputValue === '' && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleInputBlur = () => {
    if (inputValue.trim()) {
      addChip(inputValue);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-2 input-3d">
      {value.map((chip) => (
        <span
          key={chip.email}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-sm rounded-full cursor-default"
          style={{
            background: 'var(--accent-bg)',
            color: 'var(--accent)',
            border: '1px solid var(--accent-border)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            boxShadow: '0 1px 4px var(--accent-bg)',
          }}
        >
          <span>{chip.displayName}</span>
          <button
            type="button"
            onClick={() => removeChip(chip.email)}
            className="flex-shrink-0 hover:opacity-70"
          >
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onBlur={handleInputBlur}
        placeholder={value.length === 0 ? t('statistics.assigneeFilterHint') : ''}
        className="flex-1 min-w-[120px] bg-transparent text-sm focus:outline-none"
        style={{ color: 'var(--text)' }}
      />
    </div>
  );
}
