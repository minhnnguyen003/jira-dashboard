'use client';

import { useEffect } from 'react';
import { useLanguage } from '@/lib/i18n';
import { clearProfileDocumentCookie } from '@/lib/profile-cookie.js';

export default function LogoutOverlay() {
  const { t } = useLanguage();

  useEffect(() => {
    clearProfileDocumentCookie();
    const timer = setTimeout(() => {
      window.location.reload();
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className="fixed inset-0 z-[2000] flex flex-col items-center justify-center gap-4"
      style={{ background: 'rgba(4,5,16,0.78)', backdropFilter: 'blur(10px)' }}
    >
      <div
        className="w-10 h-10 rounded-full animate-spin"
        style={{
          border: '3px solid rgba(255,255,255,0.15)',
          borderTopColor: 'var(--accent)',
        }}
      />
      <div className="text-lg font-semibold" style={{ color: 'var(--text)' }}>
        {t('logout.title')}
      </div>
      <div className="text-sm" style={{ color: 'var(--text-dim)' }}>
        {t('logout.subtitle')}
      </div>
    </div>
  );
}
