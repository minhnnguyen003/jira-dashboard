'use client';

import { useLanguage } from '@/lib/i18n';
import { useEffect, useState, useRef, useMemo } from 'react';

interface LogWorkModalProps {
  issueKey: string;
  issueSummary: string;
  originalEstimate: string | null | undefined;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
}

function formatRemainingEstimate(value: string | null | undefined): string {
  if (!value || value === '0') return '0m';
  let totalSeconds: number;
  // Try parsing as numeric seconds first
  const numeric = parseInt(String(value));
  if (!isNaN(numeric) && numeric > 0) {
    totalSeconds = numeric;
  } else {
    // Parse Jira format: "10m", "2h", "3d", "1d 2h 30m"
    const regex = /(?:(\d+)d)?\s*(?:(\d+)h)?\s*(?:(\d+)m)?\s*(?:(\d+)s)?/;
    const match = String(value).match(regex);
    if (!match) return String(value);
    const days = parseInt(match[1] || '0');
    const hours = parseInt(match[2] || '0');
    const minutes = parseInt(match[3] || '0');
    totalSeconds = days * 86400 + hours * 3600 + minutes * 60;
  }

  const days = Math.floor(totalSeconds / 86400);
  const dayHours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days} day${days > 1 ? 's' : ''}`);
  if (dayHours > 0) parts.push(`${dayHours} hour${dayHours > 1 ? 's' : ''}`);
  if (minutes > 0) parts.push(`${minutes} minute${minutes > 1 ? 's' : ''}`);
  return parts.length > 0 ? parts.join(' ') : '0m';
}

type RemainingEstimateType = 'auto' | 'existing' | 'set' | 'reduce';

function getDefaultStarted(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export default function LogWorkModal({ issueKey, issueSummary, originalEstimate, onClose, onSuccess }: LogWorkModalProps) {
  const { t } = useLanguage();
  const [isLight, setIsLight] = useState(false);
  const [timeSpent, setTimeSpent] = useState('');
  const [dateStarted, setDateStarted] = useState(getDefaultStarted());
  const [remainingEstimateType, setRemainingEstimateType] = useState<RemainingEstimateType>('auto');
  const [workDescription, setWorkDescription] = useState('');
  const [customRemaining, setCustomRemaining] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const formattedOriginalEstimate = useMemo(() => formatRemainingEstimate(originalEstimate), [originalEstimate]);

  useEffect(() => {
    setIsLight(document.documentElement.getAttribute('data-theme') === 'light');
    const observer = new MutationObserver(() => {
      setIsLight(document.documentElement.getAttribute('data-theme') === 'light');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  const c = isLight ? LIGHT : DARK;

  const handleSubmit = async () => {
    if (!timeSpent.trim()) {
      setError(t('logWork.timeSpentRequired'));
      return;
    }
    if (!dateStarted) {
      setError(t('logWork.dateStartedRequired'));
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/jira/log-work', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issueKey,
          timeSpent: timeSpent.trim(),
          started: dateStarted,
          workDescription: workDescription.trim() || undefined,
          remainingEstimateType,
          remainingEstimate: customRemaining.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to log work');
        return;
      }

      await onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      onMouseDown={(e) => {
        if (e.target !== e.currentTarget) return;
        onClose();
      }}
      style={{
        background: c.backdropBlur,
        backdropFilter: 'blur(8px)',
      }}
    >
      <div
        ref={modalRef}
        className="w-full max-w-lg rounded-2xl flex flex-col"
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
        <div
          className="flex items-center justify-between px-6 py-4 border-b shrink-0"
          style={{ borderColor: c.borderRow }}
        >
          <div>
            <h2 className="text-sm font-bold" style={{ color: c.textPrimary }}>
              {t('logWork.title')}
            </h2>
            <div className="text-xs mt-0.5" style={{ color: c.textMuted }}>{issueKey}: {issueSummary}</div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-sm"
            style={{ color: c.textMuted, background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(20,22,40,0.5)' }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-y-auto px-6 py-5">
          <div className="w-full space-y-4">
            {error && (
              <div
                className="p-3 rounded-xl text-xs"
                style={{
                  background: 'rgba(242,144,150,0.15)',
                  color: '#f29096',
                  border: '1px solid rgba(242,144,150,0.3)',
                }}
              >
                {error}
              </div>
            )}

            {/* Time Spent */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: c.textMuted }}>
                {t('logWork.timeSpent')} <span style={{ color: '#f29096' }}>*</span>
              </label>
              <input
                type="text"
                value={timeSpent}
                onChange={(e) => setTimeSpent(e.target.value)}
                placeholder="1h 30m"
                className="px-3 py-2 rounded-xl text-sm w-full"
                style={{
                  background: c.inputBg,
                  border: `1px solid ${c.inputBorder}`,
                  color: c.textPrimary,
                  outline: 'none',
                }}
              />
            </div>

            {/* Date Started */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: c.textMuted }}>
                {t('logWork.dateStarted')} <span style={{ color: '#f29096' }}>*</span>
              </label>
              <input
                type="datetime-local"
                value={dateStarted}
                onChange={(e) => setDateStarted(e.target.value)}
                className="px-3 py-2 rounded-xl text-sm w-full"
                style={{
                  background: c.inputBg,
                  border: `1px solid ${c.inputBorder}`,
                  color: c.textPrimary,
                  outline: 'none',
                }}
              />
            </div>

            {/* Remaining Estimate */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: c.textMuted }}>
                {t('logWork.remainingEstimate')}
              </label>
              <select
                value={remainingEstimateType}
                onChange={(e) => setRemainingEstimateType(e.target.value as RemainingEstimateType)}
                className="px-3 py-2 rounded-xl text-sm w-full"
                style={{
                  background: c.inputBg,
                  border: `1px solid ${c.inputBorder}`,
                  color: c.textPrimary,
                  outline: 'none',
                }}
              >
                <option value="auto">{t('logWork.remainingAuto')}</option>
                <option value="existing">{t('logWork.remainingExisting')}{formattedOriginalEstimate}</option>
                <option value="set">{t('logWork.remainingSet')}</option>
                <option value="reduce">{t('logWork.remainingReduce')}</option>
              </select>
            </div>

            {/* Remaining Estimate Input (conditional) */}
            {(remainingEstimateType === 'set' || remainingEstimateType === 'reduce') && (
              <div>
                <input
                  type="text"
                  value={customRemaining}
                  onChange={(e) => setCustomRemaining(e.target.value)}
                  placeholder={remainingEstimateType === 'set' ? '1d 2h' : '1h 30m'}
                  className="px-3 py-2 rounded-xl text-sm w-full"
                  style={{
                    background: c.inputBg,
                    border: `1px solid ${c.inputBorder}`,
                    color: c.textPrimary,
                    outline: 'none',
                  }}
                />
              </div>
            )}

            {/* Work Description */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: c.textMuted }}>
                {t('logWork.workDescription')}
              </label>
              <textarea
                value={workDescription}
                onChange={(e) => setWorkDescription(e.target.value)}
                placeholder={t('logWork.descriptionPlaceholder')}
                rows={3}
                className="px-3 py-2 rounded-xl text-sm w-full resize-none"
                style={{
                  background: c.inputBg,
                  border: `1px solid ${c.inputBorder}`,
                  color: c.textPrimary,
                  outline: 'none',
                }}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-2 px-6 py-4 border-t shrink-0"
          style={{ borderColor: c.borderRow }}
        >
          <button
            onClick={onClose}
            disabled={saving}
            className="text-sm font-medium px-4 py-2 rounded-xl"
            style={{
              color: c.textMuted,
              background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(20,22,40,0.4)',
              border: `1px solid ${c.border}`,
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.5 : 1,
            }}
          >
            {t('logWork.cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="text-sm font-medium px-4 py-2 rounded-xl"
            style={{
              color: '#fff',
              background: c.accent,
              border: `1px solid ${c.accent}`,
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? '...' : t('logWork.log')}
          </button>
        </div>
      </div>
    </div>
  );
}

const DARK = {
  cardBg: 'rgba(20,22,40,0.95)',
  backdropBlur: 'rgba(0,0,0,0.75)',
  border: 'rgba(255,255,255,0.1)',
  borderRow: 'rgba(255,255,255,0.08)',
  accent: '#a094e8',
  textPrimary: '#e8eaf0',
  textSecondary: '#9095a8',
  textMuted: '#5a5f6e',
  inputBg: 'rgba(255,255,255,0.05)',
  inputBorder: 'rgba(255,255,255,0.12)',
};

const LIGHT = {
  cardBg: 'rgba(255,255,255,0.95)',
  backdropBlur: 'rgba(0,0,0,0.3)',
  border: 'rgba(0,0,0,0.1)',
  borderRow: 'rgba(0,0,0,0.06)',
  accent: '#635de8',
  textPrimary: '#1a1c28',
  textSecondary: '#5a5f70',
  textMuted: '#7a7f90',
  inputBg: 'rgba(0,0,0,0.02)',
  inputBorder: 'rgba(0,0,0,0.1)',
};
