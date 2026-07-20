'use client';

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useLanguage } from '@/lib/i18n';

interface JiraUserOption {
  name: string;
  displayName: string;
  email: string;
  avatarUrl: string;
}

interface ProfileSetupModalProps {
  onSelectProfile: (profile: { displayName: string; email: string; avatarUrl: string }) => void;
}

const DARK = {
  overlay: 'rgba(4,5,16,0.78)',
  cardBg: 'rgba(20,22,40,0.92)',
  border: 'rgba(255,255,255,0.1)',
  inputBg: 'rgba(255,255,255,0.04)',
  inputBorder: 'rgba(255,255,255,0.1)',
  resultBg: 'rgba(11,13,28,0.86)',
  resultHover: 'rgba(160,148,232,0.14)',
  text: '#e8eaf0',
  textSecondary: '#c0c4d4',
  textMuted: '#8e94a8',
};

const LIGHT = {
  overlay: 'rgba(215,218,232,0.58)',
  cardBg: 'rgba(255,255,255,0.92)',
  border: 'rgba(0,0,0,0.1)',
  inputBg: 'rgba(255,255,255,0.8)',
  inputBorder: 'rgba(0,0,0,0.1)',
  resultBg: 'rgba(255,255,255,0.96)',
  resultHover: 'rgba(99,102,241,0.08)',
  text: '#1a1c28',
  textSecondary: '#3a3e4e',
  textMuted: '#6b7285',
};

function subscribeToTheme(onStoreChange: () => void) {
  const observer = new MutationObserver(onStoreChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => observer.disconnect();
}

function getIsLightTheme() {
  return document.documentElement.getAttribute('data-theme') === 'light';
}

export default function ProfileSetupModal({ onSelectProfile }: ProfileSetupModalProps) {
  const { t } = useLanguage();
  const isLight = useSyncExternalStore(subscribeToTheme, getIsLightTheme, () => false);
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<JiraUserOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<JiraUserOption | null>(null);

  useEffect(() => {
    if (!query.trim()) {
      return;
    }

    const timer = setTimeout(() => {
      setLoading(true);
      setError(null);
      fetch(`/api/jira/users?query=${encodeURIComponent(query.trim())}`)
        .then(async (res) => {
          if (!res.ok) {
            throw new Error(`API error: ${res.status}`);
          }
          return res.json();
        })
        .then((data: JiraUserOption[]) => {
          setUsers(data);
        })
        .catch(() => {
          setUsers([]);
          setError('Không tải được danh sách người dùng');
        })
        .finally(() => setLoading(false));
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const colors = isLight ? LIGHT : DARK;
  const canSubmit = Boolean(selectedUser?.displayName);
  const showEmpty = useMemo(() => !loading && !error && query.trim().length > 0 && users.length === 0, [error, loading, query, users.length]);

  const handleConfirm = () => {
    if (!selectedUser) {
      return;
    }

    onSelectProfile({
      displayName: selectedUser.displayName,
      email: selectedUser.email || selectedUser.name,
      avatarUrl: selectedUser.avatarUrl || '',
    });
  };

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
      style={{ background: colors.overlay, backdropFilter: 'blur(10px)' }}
    >
      <div
        className="w-full max-w-xl animate-slide-up rounded-[24px] border p-6 shadow-2xl"
        style={{
          background: colors.cardBg,
          borderColor: colors.border,
          backdropFilter: 'blur(24px) saturate(1.2)',
          WebkitBackdropFilter: 'blur(24px) saturate(1.2)',
          boxShadow: isLight
            ? '0 24px 80px rgba(15,23,42,0.16), inset 0 1px 0 rgba(255,255,255,0.8)'
            : '0 24px 80px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.05)',
        }}
      >
        <div className="mb-5">
          <h2 className="text-[2rem] leading-none font-semibold" style={{ color: colors.text }}>Thiết lập người dùng</h2>
          <p className="mt-3 text-sm leading-6" style={{ color: colors.textMuted }}>
            Chọn tên người dùng trước khi sử dụng hệ thống.
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium mb-2" style={{ color: colors.textMuted }}>
            Tên người dùng
          </label>
          <input
            type="text"
            value={query}
            onChange={(e) => {
              const nextQuery = e.target.value;
              setQuery(nextQuery);
              setSelectedUser(null);
              if (!nextQuery.trim()) {
                setUsers([]);
                setLoading(false);
                setError(null);
              }
            }}
            placeholder={t('createTask.assigneePlaceholder')}
            className="w-full rounded-2xl px-4 py-3 text-sm outline-none transition-all"
            style={{
              color: colors.text,
              background: colors.inputBg,
              border: `1px solid ${colors.inputBorder}`,
              boxShadow: isLight
                ? 'inset 0 1px 0 rgba(255,255,255,0.85)'
                : 'inset 0 1px 0 rgba(255,255,255,0.04)',
            }}
            autoFocus
          />
        </div>

        <div
          className="mt-4 min-h-[168px] rounded-2xl border overflow-hidden"
          style={{
            background: colors.resultBg,
            borderColor: colors.border,
          }}
        >
          <div className="px-4 py-3 border-b text-xs font-medium" style={{ color: colors.textMuted, borderColor: colors.border }}>
            Kết quả tìm kiếm
          </div>

          <div className="max-h-[220px] overflow-y-auto">
            {loading && (
              <div className="px-4 py-4 text-sm" style={{ color: colors.textMuted }}>
                Đang tải người dùng...
              </div>
            )}

            {error && (
              <div className="px-4 py-4 text-sm" style={{ color: 'var(--danger)' }}>
                {error}
              </div>
            )}

            {showEmpty && (
              <div className="px-4 py-4 text-sm" style={{ color: colors.textMuted }}>
                Không tìm thấy người dùng phù hợp
              </div>
            )}

            {!loading && !error && users.map((user) => {
              const isSelected = selectedUser?.email === user.email;

              return (
                <button
                  key={`${user.email}-${user.name}`}
                  type="button"
                  onClick={() => {
                    setSelectedUser(user);
                    setQuery(user.displayName);
                  }}
                  className="w-full px-4 py-3 text-left transition-colors"
                  style={{
                    background: isSelected ? colors.resultHover : 'transparent',
                    borderTop: `1px solid ${colors.border}`,
                  }}
                >
                  <div className="text-sm font-medium" style={{ color: colors.text }}>{user.displayName}</div>
                  <div className="mt-1 text-xs" style={{ color: colors.textMuted }}>{user.email || user.name}</div>
                </button>
              );
            })}

            {!loading && !error && !query.trim() && (
              <div className="px-4 py-4 text-sm" style={{ color: colors.textMuted }}>
                Nhập tên hoặc email để tìm kiếm người dùng.
              </div>
            )}
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs leading-5" style={{ color: colors.textMuted }}>
            Bạn cần chọn một user từ danh sách gợi ý để tiếp tục.
          </div>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canSubmit}
            className="btn-primary px-5 py-2.5 text-sm disabled:opacity-40"
          >
            Xác nhận
          </button>
        </div>
      </div>
    </div>
  );
}
