'use client';

import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '@/lib/i18n';
import { readProfileFromDocumentCookie } from '@/lib/profile-cookie.js';
import { getUserInitials } from '@/lib/userInitials.js';

interface UserBarProps {
  collapsed: boolean;
  onLogout: () => void;
}

interface ProfileState {
  displayName: string;
  email: string;
  avatarUrl: string;
}

export default function UserBar({ collapsed, onLogout }: UserBarProps) {
  const { t } = useLanguage();
  const [profile, setProfile] = useState<ProfileState | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProfile(readProfileFromDocumentCookie());
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  if (!profile?.displayName) {
    return null;
  }

  const showImage = Boolean(profile.avatarUrl) && !avatarFailed;

  const avatar = (
    <span
      className="flex-shrink-0 flex items-center justify-center rounded-full overflow-hidden"
      style={{
        width: 32,
        height: 32,
        background: 'var(--accent-bg)',
        color: 'var(--accent)',
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={profile.avatarUrl}
          alt={profile.displayName}
          width={32}
          height={32}
          style={{ width: 32, height: 32, objectFit: 'cover' }}
          onError={() => setAvatarFailed(true)}
        />
      ) : (
        getUserInitials(profile.displayName)
      )}
    </span>
  );

  return (
    <div
      ref={containerRef}
      className="relative px-2 py-2"
      style={{ borderBottom: '1px solid var(--border)' }}
    >
      <button
        type="button"
        onClick={() => setMenuOpen((open) => !open)}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-xl transition-all duration-200"
        style={{
          justifyContent: collapsed ? 'center' : 'flex-start',
          background: 'transparent',
          color: 'var(--text-dim)',
          cursor: 'pointer',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-bg)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        title={collapsed ? profile.displayName : undefined}
      >
        {avatar}
        {!collapsed && (
          <span className="flex-1 min-w-0 text-left">
            <span
              className="block text-sm font-medium truncate"
              style={{ color: 'var(--text)' }}
            >
              {profile.displayName}
            </span>
            {profile.email && (
              <span className="block text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                {profile.email}
              </span>
            )}
          </span>
        )}
      </button>

      {menuOpen && (
        <div
          className="absolute mt-1 rounded-xl z-[60] overflow-hidden"
          style={{
            top: '100%',
            left: 8,
            ...(collapsed ? { width: 180 } : { right: 8 }),
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          }}
        >
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              onLogout();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-all duration-200"
            style={{ color: 'var(--text-dim)', background: 'transparent', cursor: 'pointer' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>{t('nav.logout')}</span>
          </button>
        </div>
      )}
    </div>
  );
}
