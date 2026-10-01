'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/lib/i18n';
import UserBar from '@/components/layout/UserBar';
import LogoutOverlay from '@/components/layout/LogoutOverlay';
import ThemePicker from '@/components/layout/ThemePicker';

interface SubMenuItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  disabled?: boolean;
}

interface MenuItem {
  href?: string;
  icon: React.ReactNode;
  label: string;
  subItems?: SubMenuItem[];
}

const menuLabelKeys: Record<string, Parameters<ReturnType<typeof useLanguage>['t']>[0]> = {
  'Chạy query JQL': 'nav.customJql',
  'Bảng Kanban Tuần': 'nav.weeklyPlan',
  'Lịch công việc': 'nav.calendar',
  'Duyệt Task': 'nav.browseTasks',
  'Thống kê': 'nav.statistics',
  'Thống kê tổng hợp': 'nav.statisticsOverview',
  'Thống kê cá nhân': 'nav.personalStatistics',
  'Thống kê số giờ log theo ngày': 'nav.hoursByDate',
};

const menuItems: MenuItem[] = [
  {
    href: '/weekly-plan',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m6 10V3m-9 8h12M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    label: 'Bảng Kanban Tuần',
  },
  {
    href: '/calendar',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3M4 11h16M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z" />
      </svg>
    ),
    label: 'Lịch công việc',
  },
  {
    href: '/custom-jql',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
    label: 'Chạy query JQL',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    label: 'Thống kê',
    subItems: [
      {
        href: '/statistics',
        label: 'Thống kê tổng hợp',
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        ),
      },
      {
        href: '/statistics/personal',
        label: 'Thống kê cá nhân',
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A8.962 8.962 0 0112 15a8.962 8.962 0 016.879 2.804M15 9a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        ),
      },
      {
        href: '/statistics/hours-by-date',
        label: 'Thống kê số giờ log theo ngày',
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        ),
      },
    ],
  },
  {
    href: '/browse-tasks',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
      </svg>
    ),
    label: 'Duyệt Task',
  },
];

function getActiveMenuLabels(pathname: string) {
  return new Set(
    menuItems
      .filter((item) => item.subItems?.some((sub) => pathname === sub.href))
      .map((item) => item.label),
  );
}

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [isNarrowViewport, setIsNarrowViewport] = useState(false);
  const pathname = usePathname();
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(() => getActiveMenuLabels(pathname));
  const [expandedPathname, setExpandedPathname] = useState(pathname);
  const [loggingOut, setLoggingOut] = useState(false);
  const { language, toggleLanguage, t } = useLanguage();
  const effectiveCollapsed = collapsed || isNarrowViewport;

  if (expandedPathname !== pathname) {
    setExpandedPathname(pathname);
    setExpandedMenus((previous) => new Set([...previous, ...getActiveMenuLabels(pathname)]));
  }

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const updateViewport = () => setIsNarrowViewport(mediaQuery.matches);
    updateViewport();
    mediaQuery.addEventListener('change', updateViewport);
    return () => mediaQuery.removeEventListener('change', updateViewport);
  }, []);

  useEffect(() => {
    document.getElementById('main-content')?.style.setProperty('margin-left', effectiveCollapsed ? '56px' : '224px');
  }, [effectiveCollapsed]);

  const toggleExpand = (label: string) => {
    setExpandedMenus((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  };

  const hasSubItems = (item: MenuItem) => item.subItems && item.subItems.length > 0;
  const isMenuExpanded = (label: string) => expandedMenus.has(label);
  const isItemActive = (item: MenuItem) => {
    if (item.href && pathname === item.href) return true;
    if (item.subItems) {
      return item.subItems.some((sub) => pathname === sub.href);
    }
    return false;
  };

  return (
    <>
    {loggingOut && <LogoutOverlay />}
    <aside
      className="app-sidebar flex flex-col fixed top-0 left-0 h-screen z-50 transition-all duration-200"
      style={{
        width: effectiveCollapsed ? 56 : 224,
        borderRight: '1px solid var(--border)',
        boxShadow: '4px 0 24px rgba(0,0,0,0.15), inset 0 0 0 1px rgba(255,255,255,0.03)',
      }}
    >
      {/* Iridescent border accent */}
      <div
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: '1px',
          background: 'linear-gradient(180deg, var(--accent), var(--success), transparent, var(--accent))',
          opacity: 0.5,
        }}
      />

      <div
        className={`flex items-center ${effectiveCollapsed ? 'justify-center px-0' : 'justify-between px-3'}`}
        style={{
          height: 56,
          borderBottom: '1px solid var(--border)',
        }}
      >
        {!effectiveCollapsed && (
          <h1
            className="text-sm font-bold tracking-wide"
            style={{
              color: 'var(--text)',
              background: 'linear-gradient(135deg, var(--accent), var(--success))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Jira Dashboard
          </h1>
        )}
        <div className="flex items-center gap-1">
          {!effectiveCollapsed && (
            <>
              <ThemePicker />
              <button
                onClick={toggleLanguage}
                className="px-2 py-1 rounded-lg transition-all duration-200 text-[10px] font-semibold"
                style={{ color: 'var(--text-dim)', background: 'transparent', border: '1px solid var(--border)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-bg)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                title={t('language.switchTo', { language: language === 'vi' ? t('language.en') : t('language.vi') })}
              >
                {language === 'vi' ? 'EN' : 'VI'}
              </button>
            </>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-lg transition-all duration-200"
            style={{ color: 'var(--text-dim)' }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--accent-bg)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={effectiveCollapsed ? 'M9 5l7 7-7 7' : 'M15 19l-7-7 7-7'} />
            </svg>
          </button>
        </div>
      </div>
      <UserBar collapsed={effectiveCollapsed} onLogout={() => setLoggingOut(true)} />
      <nav className={`flex-1 py-3 ${effectiveCollapsed ? 'px-1' : 'px-2'}`}>
        <ul className="space-y-1">
          {menuItems.map((item) => {
            const active = isItemActive(item);
            const expanded = isMenuExpanded(item.label);
            const hasSub = hasSubItems(item);

            if (!hasSub) {
              return (
                <li key={item.label}>
                  <Link
                    href={item.href || '#'}
                    className={`flex items-center py-2 rounded-xl transition-all duration-200 ${effectiveCollapsed ? 'justify-center px-0' : 'gap-3 px-3'}`}
                    style={{
                      color: active ? 'var(--bg)' : 'var(--text-dim)',
                      background: active ? 'var(--accent)' : 'transparent',
                      fontWeight: active ? 600 : 400,
                      boxShadow: active ? '0 2px 8px var(--accent-glow), inset 0 1px 0 rgba(255,255,255,0.15)' : 'none',
                    }}
                    onMouseEnter={(e) => {
                      if (!active) e.currentTarget.style.background = 'var(--accent-bg)';
                    }}
                    onMouseLeave={(e) => {
                      if (!active) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <span className="flex-shrink-0">{item.icon}</span>
                    {!effectiveCollapsed && <span className="text-sm font-medium">{t(menuLabelKeys[item.label])}</span>}
                  </Link>
                </li>
              );
            }

            return (
              <li key={item.label}>
                <button
                  onClick={() => !effectiveCollapsed && toggleExpand(item.label)}
                  className={`w-full flex items-center py-2 rounded-xl transition-all duration-200 ${effectiveCollapsed ? 'justify-center px-0' : 'gap-3 px-3'}`}
                  style={{
                    color: active ? 'var(--bg)' : 'var(--text-dim)',
                    background: active ? 'var(--accent)' : 'transparent',
                    fontWeight: active ? 600 : 400,
                    boxShadow: active ? '0 2px 8px var(--accent-glow), inset 0 1px 0 rgba(255,255,255,0.15)' : 'none',
                    cursor: effectiveCollapsed ? 'default' : 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    if (!effectiveCollapsed && !active) e.currentTarget.style.background = 'var(--accent-bg)';
                  }}
                  onMouseLeave={(e) => {
                    if (!active) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <span className="flex-shrink-0">{item.icon}</span>
                  {!effectiveCollapsed && (
                    <>
                      <span className="text-sm font-medium flex-1 text-left">{t(menuLabelKeys[item.label])}</span>
                      <svg
                        className={`w-3.5 h-3.5 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </>
                  )}
                </button>
                {!effectiveCollapsed && expanded && item.subItems && (
                  <div className="mt-1.5 ml-5 space-y-0.5">
                    {item.subItems.map((sub) => {
                      const subActive = pathname === sub.href;
                      return (
                        <Link
                          key={sub.href}
                          href={sub.disabled ? '#' : sub.href}
                          className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg transition-all duration-200"
                          style={{
                            color: sub.disabled ? 'var(--text-muted)' : subActive ? 'var(--accent)' : 'var(--text-dim)',
                            background: subActive ? 'var(--accent-bg)' : 'transparent',
                            fontWeight: subActive ? 500 : 400,
                            fontSize: '13px',
                            pointerEvents: sub.disabled ? 'none' : 'auto',
                            cursor: sub.disabled ? 'not-allowed' : 'pointer',
                            opacity: sub.disabled ? 0.5 : 1,
                          }}
                          onMouseEnter={(e) => {
                            if (!subActive && !sub.disabled) e.currentTarget.style.background = 'var(--surface-hover)';
                          }}
                          onMouseLeave={(e) => {
                            if (!subActive) e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          <span className="flex-shrink-0" style={{ opacity: sub.disabled ? 0.5 : 1 }}>{sub.icon}</span>
                          <span>{t(menuLabelKeys[sub.label])}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
    </>
  );
}



