'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useLanguage } from '@/lib/i18n';

type CalendarType = 'holiday' | 'additional';
type CalendarEntry = { date: string; name: string };
type CalendarResponse = { holidays: CalendarEntry[]; additionalDays: CalendarEntry[] };

const emptyEntry: CalendarEntry = { date: '', name: '' };

function CalendarSection({
  type,
  title,
  entries,
  onChanged,
}: {
  type: CalendarType;
  title: string;
  entries: CalendarEntry[];
  onChanged: (entries: CalendarEntry[]) => void;
}) {
  const { t } = useLanguage();
  const [entry, setEntry] = useState<CalendarEntry>(emptyEntry);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setEntry(emptyEntry);
    setEditingDate(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const response = await fetch('/api/calendar/config', {
        method: editingDate ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, entry, originalDate: editingDate }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Không thể lưu dữ liệu lịch.');
      onChanged(data.entries);
      resetForm();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Không thể lưu dữ liệu lịch.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (date: string) => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/calendar/config?type=${type}&date=${encodeURIComponent(date)}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Không thể xóa dữ liệu lịch.');
      onChanged(data.entries);
      if (editingDate === date) resetForm();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Không thể xóa dữ liệu lịch.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="glass-card-subtle rounded-2xl p-4 sm:p-5">
      <h2 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>{title}</h2>
      <form className="mt-4 grid gap-3 sm:grid-cols-[150px_1fr_auto]" onSubmit={handleSubmit}>
        <label className="grid gap-1 text-xs font-medium" style={{ color: 'var(--text-dim)' }}>
          {t('calendarConfig.dateLabel')}
          <input className="input-field px-3 py-2 text-sm" type="date" required value={entry.date} onChange={(event) => setEntry((previous) => ({ ...previous, date: event.target.value }))} />
        </label>
        <label className="grid gap-1 text-xs font-medium" style={{ color: 'var(--text-dim)' }}>
          {t('calendarConfig.nameLabel')}
          <input className="input-field px-3 py-2 text-sm" required value={entry.name} placeholder={t('calendarConfig.namePlaceholder')} onChange={(event) => setEntry((previous) => ({ ...previous, name: event.target.value }))} />
        </label>
        <div className="flex items-end gap-2">
          <button className="btn-primary px-4 py-2 text-sm" disabled={saving} type="submit">{editingDate ? t('calendarConfig.save') : t('calendarConfig.add')}</button>
          {editingDate && <button className="page-btn px-3 py-2 text-sm" disabled={saving} type="button" onClick={resetForm}>{t('calendarConfig.cancel')}</button>}
        </div>
      </form>

      {error && <p className="mt-3 rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>{error}</p>}

      <div className="table-wrap mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead><tr><th className="px-4 py-3">{t('calendarConfig.dateLabel')}</th><th className="px-4 py-3">{t('calendarConfig.nameLabel')}</th><th className="px-4 py-3 text-right">{t('table.columns')}</th></tr></thead>
          <tbody>
            {entries.map((item) => (
              <tr key={item.date}>
                <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--text)' }}>{item.date}</td>
                <td className="px-4 py-3" style={{ color: 'var(--text-dim)' }}>{item.name}</td>
                <td className="px-4 py-3"><div className="flex justify-end gap-2"><button className="page-btn px-3 py-1.5 text-xs" disabled={saving} type="button" onClick={() => { setEntry(item); setEditingDate(item.date); setError(null); }}>{t('calendarConfig.edit')}</button><button className="page-btn px-3 py-1.5 text-xs" disabled={saving} type="button" onClick={() => void handleDelete(item.date)} style={{ color: 'var(--danger)' }}>{t('calendarConfig.delete')}</button></div></td>
              </tr>
            ))}
            {entries.length === 0 && <tr><td className="px-4 py-8 text-center" colSpan={3} style={{ color: 'var(--text-muted)' }}>{t('calendarConfig.empty')}</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function CalendarConfigPage() {
  const { t } = useLanguage();
  const [data, setData] = useState<CalendarResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch('/api/calendar/config', { cache: 'no-store' });
        const nextData = await response.json();
        if (!response.ok) throw new Error(nextData.error || 'Không thể tải dữ liệu lịch.');
        setData(nextData);
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : 'Không thể tải dữ liệu lịch.');
      }
    };
    void load();
  }, []);

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4 p-3 sm:p-4" style={{ minHeight: 'calc(100vh - 56px)' }}>
      <div><h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{t('calendarConfig.title')}</h1><p className="mt-1 text-sm" style={{ color: 'var(--text-dim)' }}>{t('calendarConfig.subtitle')}</p></div>
      {error && <div className="rounded-xl p-3 text-sm" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>{error}</div>}
      {!data && !error && <div className="flex flex-1 items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>{t('calendarConfig.loading')}</div>}
      {data && <div className="grid gap-4 xl:grid-cols-2"><CalendarSection type="holiday" title={t('calendarConfig.holidayTitle')} entries={data.holidays} onChanged={(holidays) => setData((previous) => previous ? { ...previous, holidays } : previous)} /><CalendarSection type="additional" title={t('calendarConfig.additionalTitle')} entries={data.additionalDays} onChanged={(additionalDays) => setData((previous) => previous ? { ...previous, additionalDays } : previous)} /></div>}
    </div>
  );
}
