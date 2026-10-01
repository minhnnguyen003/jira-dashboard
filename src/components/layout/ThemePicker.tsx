'use client';

import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '@/lib/i18n';
import { THEMES, applyTheme, getStoredThemeId, setTheme, useThemeId } from '@/lib/theme';

export default function ThemePicker() {
  const { t } = useLanguage();
  const themeId = useThemeId();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Sync the DOM with the saved theme on mount (the inline init script covers first paint).
  useEffect(() => {
    applyTheme(getStoredThemeId());
  }, []);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`btn btn-bare btn-icon${open ? ' is-active' : ''}`}
        title={t('theme.choose')}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
        </svg>
      </button>
      {open && (
        <div
          role="listbox"
          aria-label={t('theme.choose')}
          className="absolute left-0 mt-2 w-56 rounded-xl p-1.5 z-50 overflow-y-auto"
          style={{
            background: 'var(--dropdown-bg)',
            border: '1px solid var(--border-hover)',
            boxShadow: 'var(--glass-shadow-hover)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            maxHeight: 'min(70vh, 480px)',
          }}
        >
          {(['dark', 'light'] as const).map((mode) => (
            <div key={mode} role="group" aria-label={t(mode === 'dark' ? 'theme.mode.dark' : 'theme.mode.light')}>
              <div className="px-2 pt-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                {t(mode === 'dark' ? 'theme.mode.dark' : 'theme.mode.light')}
              </div>
              {THEMES.filter((theme) => theme.mode === mode).map((theme) => {
                const selected = theme.id === themeId;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => { setTheme(theme.id); setOpen(false); }}
                    className={`btn btn-bare w-full justify-start gap-2.5 px-2 py-1.5 text-xs${selected ? ' is-active' : ''}`}
                  >
                    <span
                      className="flex shrink-0 overflow-hidden rounded-md"
                      style={{ width: 36, height: 22, border: '1px solid var(--border-hover)' }}
                      aria-hidden
                    >
                      <span style={{ flex: 1, background: theme.swatch[0] }} />
                      <span style={{ flex: 1, background: theme.swatch[1] }} />
                      <span style={{ flex: 1, background: theme.swatch[2] }} />
                    </span>
                    <span className="flex-1 text-left">{t(theme.labelKey)}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
