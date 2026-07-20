'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/lib/i18n';
import CreateTaskModal from '@/components/modal/CreateTaskModal';
import UserBar from '@/components/layout/UserBar';
import LogoutOverlay from '@/components/layout/LogoutOverlay';

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
  'Quản lý Task': 'nav.taskManagement',
  'Tạo Task': 'nav.createTask',
  'Tạo Task hàng loạt': 'nav.createTaskBulk',
  'Quản lý công việc': 'nav.workManagement',
  'Duyệt Task': 'nav.browseTasks',
  'Thống kê': 'nav.statistics',
  'Thống kê tổng hợp': 'nav.statisticsOverview',
  'Thống kê cá nhân': 'nav.personalStatistics',
  'Thống kê số giờ log theo ngày': 'nav.hoursByDate',
};

const menuItems: MenuItem[] = [
  {
    href: '/browse-tasks',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
      </svg>
    ),
    label: 'Duyệt Task',
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
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
    label: 'Quản lý Task',
    subItems: [
      {
        href: '/create-task',
        label: 'Tạo Task',
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        ),
      },
      {
        href: '/create-task-bulk',
        label: 'Tạo Task hàng loạt',
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        ),
        disabled: true,
      },
      {
        href: '/work-management',
        label: 'Quản lý công việc',
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        ),
      },
    ],
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
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const [isDarkSet, setIsDarkSet] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const pathname = usePathname();
  const { language, toggleLanguage, t } = useLanguage();

  useEffect(() => {
    const stored = window.localStorage.getItem('theme');
    if (stored === 'light' || stored === 'dark') {
      setIsDark(stored !== 'light');
    }
    setIsDarkSet(true);
  }, []);

  useEffect(() => {
    if (!isDarkSet) return;
    document.getElementById('main-content')?.style.setProperty('margin-left', collapsed ? '56px' : '224px');
  }, [collapsed, isDarkSet]);

  useEffect(() => {
    if (isDark) {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
    }
  }, [isDark]);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    if (next) {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
      localStorage.setItem('theme', 'light');
    }
  };

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

  // Auto-expand when on a sub-item page
  useEffect(() => {
    menuItems.forEach((item) => {
      if (item.subItems) {
        const hasActiveSub = item.subItems.some((sub) => pathname === sub.href);
        if (hasActiveSub) {
          setExpandedMenus((prev) => {
            const next = new Set(prev);
            next.add(item.label);
            return next;
          });
        }
      }
    });
  }, [pathname]);

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
    {showCreateModal && <CreateTaskModal onClose={() => setShowCreateModal(false)} />}
    {loggingOut && <LogoutOverlay />}
    <aside
      className="flex flex-col fixed top-0 left-0 h-screen z-50 transition-all duration-200"
      style={{
        width: collapsed ? 56 : 224,
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
        className="flex items-center justify-between px-3"
        style={{
          height: 56,
          borderBottom: '1px solid var(--border)',
        }}
      >
        {!collapsed && (
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
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-lg transition-all duration-200"
            style={{
              color: 'var(--text-dim)',
              background: 'transparent',
            }}
            onMouseEnter={(e) => { if (!collapsed) e.currentTarget.style.background = 'var(--accent-bg)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            title={isDark ? t('theme.light') : t('theme.dark')}
          >
            {isDark ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
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
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-lg transition-all duration-200"
            style={{ color: 'var(--text-dim)' }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--accent-bg)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={collapsed ? 'M9 5l7 7-7 7' : 'M15 19l-7-7 7-7'} />
            </svg>
          </button>
        </div>
      </div>
      <UserBar collapsed={collapsed} onLogout={() => setLoggingOut(true)} />
      <nav className="flex-1 py-3 px-2">
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
                    className="flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200"
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
                    {!collapsed && <span className="text-sm font-medium">{t(menuLabelKeys[item.label])}</span>}
                  </Link>
                </li>
              );
            }

            return (
              <li key={item.label}>
                <button
                  onClick={() => !collapsed && toggleExpand(item.label)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200"
                  style={{
                    color: active ? 'var(--bg)' : 'var(--text-dim)',
                    background: active ? 'var(--accent)' : 'transparent',
                    fontWeight: active ? 600 : 400,
                    boxShadow: active ? '0 2px 8px var(--accent-glow), inset 0 1px 0 rgba(255,255,255,0.15)' : 'none',
                    cursor: collapsed ? 'default' : 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    if (!collapsed && !active) e.currentTarget.style.background = 'var(--accent-bg)';
                  }}
                  onMouseLeave={(e) => {
                    if (!active) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <span className="flex-shrink-0">{item.icon}</span>
                  {!collapsed && (
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
                {!collapsed && expanded && item.subItems && (
                  <div className="mt-1.5 ml-5 space-y-0.5">
                    {item.subItems.map((sub) => {
                      const subActive = pathname === sub.href;
                      if (sub.label === 'Tạo Task') {
                        return (
                          <button
                            key={sub.href}
                            type="button"
                            onClick={() => setShowCreateModal(true)}
                            className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg transition-all duration-200"
                            style={{
                              color: 'var(--text-dim)',
                              background: 'transparent',
                              fontWeight: 400,
                              fontSize: '13px',
                              cursor: 'pointer',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-hover)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                          >
                            <span className="flex-shrink-0">{sub.icon}</span>
                            <span>{t(menuLabelKeys[sub.label])}</span>
                          </button>
                        );
                      }
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



