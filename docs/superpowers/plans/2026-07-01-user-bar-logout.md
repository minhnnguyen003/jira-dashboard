# User Bar + Logout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a user info bar (avatar + name + email) in the sidebar between the title header and the nav menu, with a click-to-open Logout dropdown that shows a full-screen "Logging out" overlay, clears the profile cookies, and reloads.

**Architecture:** Extend the existing `profile-cookie.js` to store a third cookie (`jira_avatar_url`). Map Jira's `avatarUrls['48x48']` through the users API and persist it when a user picks their profile. Render a new `UserBar` client component inside `Sidebar` and a `LogoutOverlay` component that clears cookies then reloads. Cookie profile stays the single source of truth — no new context.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, plain JS lib modules, Node.js built-in test runner (`node --test`, `.test.mjs`).

---

## File Structure

- `src/lib/profile-cookie.js` — MODIFY: add avatar cookie name, parse/build/clear it.
- `src/lib/profile-cookie.test.mjs` — MODIFY: add avatar roundtrip + clear tests.
- `src/lib/userInitials.js` — CREATE: pure helper deriving initials from a display name.
- `src/lib/userInitials.test.mjs` — CREATE: tests for the helper.
- `src/app/api/jira/users/route.ts` — MODIFY: map `avatarUrl` into response.
- `src/lib/i18n.tsx` — MODIFY: add `nav.logout`, `logout.title`, `logout.subtitle` (vi + en).
- `src/components/profile/ProfileSetupModal.tsx` — MODIFY: carry `avatarUrl` through selection.
- `src/components/profile/ProfileGate.tsx` — MODIFY: store `avatarUrl` in cookie + state type.
- `src/components/layout/LogoutOverlay.tsx` — CREATE: full-screen overlay, clears cookies, reloads.
- `src/components/layout/UserBar.tsx` — CREATE: the bar + dropdown.
- `src/components/layout/Sidebar.tsx` — MODIFY: render `<UserBar collapsed={collapsed} />` and overlay.

**Test command (this repo has no `test` npm script):** `node --test <path>.test.mjs`

---

## Task 1: Avatar cookie in the cookie layer

**Files:**
- Modify: `src/lib/profile-cookie.js`
- Test: `src/lib/profile-cookie.test.mjs`

- [ ] **Step 1: Update existing tests + add avatar tests**

Replace the body of `src/lib/profile-cookie.test.mjs` with:

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PROFILE_COOKIE_MAX_AGE_SECONDS,
  PROFILE_COOKIE_NAMES,
  buildProfileCookieAssignments,
  parseProfileCookieString,
} from './profile-cookie.js';

test('parseProfileCookieString returns null when display name is missing', () => {
  assert.equal(parseProfileCookieString('jira_email=minh%40etc.vn'), null);
});

test('parseProfileCookieString returns profile with empty avatar when only name+email exist', () => {
  assert.deepEqual(
    parseProfileCookieString('jira_display_name=Minh%20Nguyen; jira_email=minh%40etc.vn'),
    {
      displayName: 'Minh Nguyen',
      email: 'minh@etc.vn',
      avatarUrl: '',
    },
  );
});

test('parseProfileCookieString decodes avatar url when present', () => {
  const cookie =
    'jira_display_name=Minh%20Nguyen; jira_email=minh%40etc.vn; ' +
    'jira_avatar_url=https%3A%2F%2Fjira%2Favatar%3Fsize%3D48';
  assert.deepEqual(parseProfileCookieString(cookie), {
    displayName: 'Minh Nguyen',
    email: 'minh@etc.vn',
    avatarUrl: 'https://jira/avatar?size=48',
  });
});

test('buildProfileCookieAssignments creates 2-year cookies for name, email, avatar', () => {
  const assignments = buildProfileCookieAssignments({
    displayName: 'Minh Nguyen',
    email: 'minh@etc.vn',
    avatarUrl: 'https://jira/avatar?size=48',
  });

  assert.equal(assignments.length, 3);
  assert.ok(assignments[0].includes(`${PROFILE_COOKIE_NAMES.displayName}=Minh%20Nguyen`));
  assert.ok(assignments[1].includes(`${PROFILE_COOKIE_NAMES.email}=minh%40etc.vn`));
  assert.ok(assignments[2].includes(`${PROFILE_COOKIE_NAMES.avatarUrl}=https%3A%2F%2Fjira%2Favatar%3Fsize%3D48`));
  assert.ok(assignments.every((cookie) => cookie.includes(`Max-Age=${PROFILE_COOKIE_MAX_AGE_SECONDS}`)));
  assert.ok(assignments.every((cookie) => cookie.includes('Path=/')));
  assert.ok(assignments.every((cookie) => cookie.includes('SameSite=Lax')));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test src/lib/profile-cookie.test.mjs`
Expected: FAIL (avatar assertions fail; `parseProfileCookieString` returns object without `avatarUrl`, `buildProfileCookieAssignments` returns length 2).

- [ ] **Step 3: Implement avatar support in the cookie layer**

In `src/lib/profile-cookie.js`, add `avatarUrl` to the names map:

```javascript
export const PROFILE_COOKIE_NAMES = {
  displayName: 'jira_display_name',
  email: 'jira_email',
  avatarUrl: 'jira_avatar_url',
};
```

Update `parseProfileCookieString` to read + return the avatar:

```javascript
export function parseProfileCookieString(cookieString) {
  const cookies = parseCookieEntries(cookieString);
  const rawDisplayName = cookies[PROFILE_COOKIE_NAMES.displayName];
  const rawEmail = cookies[PROFILE_COOKIE_NAMES.email];
  const rawAvatarUrl = cookies[PROFILE_COOKIE_NAMES.avatarUrl];

  if (!rawDisplayName) {
    return null;
  }

  return {
    displayName: decodeURIComponent(rawDisplayName),
    email: rawEmail ? decodeURIComponent(rawEmail) : '',
    avatarUrl: rawAvatarUrl ? decodeURIComponent(rawAvatarUrl) : '',
  };
}
```

Update `buildProfileCookieAssignments` to add the avatar cookie:

```javascript
export function buildProfileCookieAssignments(profile) {
  const encodedDisplayName = encodeURIComponent(profile.displayName || '');
  const encodedEmail = encodeURIComponent(profile.email || '');
  const encodedAvatarUrl = encodeURIComponent(profile.avatarUrl || '');
  const sharedAttributes = `Max-Age=${PROFILE_COOKIE_MAX_AGE_SECONDS}; Path=/; SameSite=Lax`;

  return [
    `${PROFILE_COOKIE_NAMES.displayName}=${encodedDisplayName}; ${sharedAttributes}`,
    `${PROFILE_COOKIE_NAMES.email}=${encodedEmail}; ${sharedAttributes}`,
    `${PROFILE_COOKIE_NAMES.avatarUrl}=${encodedAvatarUrl}; ${sharedAttributes}`,
  ];
}
```

Update `clearProfileDocumentCookie` to also clear the avatar cookie:

```javascript
export function clearProfileDocumentCookie() {
  if (typeof document === 'undefined') {
    return;
  }

  document.cookie = `${PROFILE_COOKIE_NAMES.displayName}=; Max-Age=0; Path=/; SameSite=Lax`;
  document.cookie = `${PROFILE_COOKIE_NAMES.email}=; Max-Age=0; Path=/; SameSite=Lax`;
  document.cookie = `${PROFILE_COOKIE_NAMES.avatarUrl}=; Max-Age=0; Path=/; SameSite=Lax`;
}
```

(`readProfileFromDocumentCookie` and `writeProfileToDocumentCookie` need no changes — they delegate to the functions above.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test src/lib/profile-cookie.test.mjs`
Expected: PASS (all 4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/profile-cookie.js src/lib/profile-cookie.test.mjs
git commit -m "feat: store jira avatar url in profile cookie"
```

---

## Task 2: Initials helper

**Files:**
- Create: `src/lib/userInitials.js`
- Test: `src/lib/userInitials.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `src/lib/userInitials.test.mjs`:

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';

import { getUserInitials } from './userInitials.js';

test('returns first letters of first two words, uppercased', () => {
  assert.equal(getUserInitials('Minh Nguyen'), 'MN');
});

test('returns single letter for a one-word name', () => {
  assert.equal(getUserInitials('Minh'), 'M');
});

test('ignores extra whitespace between words', () => {
  assert.equal(getUserInitials('  Minh   Van  Nguyen '), 'MV');
});

test('returns "?" for empty or missing name', () => {
  assert.equal(getUserInitials(''), '?');
  assert.equal(getUserInitials(undefined), '?');
  assert.equal(getUserInitials(null), '?');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/lib/userInitials.test.mjs`
Expected: FAIL with module not found / `getUserInitials is not a function`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/userInitials.js`:

```javascript
export function getUserInitials(displayName) {
  const words = String(displayName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    return '?';
  }

  return words
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/lib/userInitials.test.mjs`
Expected: PASS (all 4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/userInitials.js src/lib/userInitials.test.mjs
git commit -m "feat: add user initials helper"
```

---

## Task 3: Return avatar URL from users API

**Files:**
- Modify: `src/app/api/jira/users/route.ts:62-66`

- [ ] **Step 1: Map avatarUrl in the response**

In `src/app/api/jira/users/route.ts`, update the `.map` to include the avatar. Replace:

```typescript
    const users = (response.data as Array<{ name?: string; displayName?: string; emailAddress?: string }>).map((u) => ({
      name: u.name || '',
      displayName: u.displayName || u.name || '',
      email: u.emailAddress || u.name || '',
    }));
```

with:

```typescript
    const users = (
      response.data as Array<{
        name?: string;
        displayName?: string;
        emailAddress?: string;
        avatarUrls?: Record<string, string>;
      }>
    ).map((u) => ({
      name: u.name || '',
      displayName: u.displayName || u.name || '',
      email: u.emailAddress || u.name || '',
      avatarUrl: u.avatarUrls?.['48x48'] || '',
    }));
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new errors from this file.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/jira/users/route.ts
git commit -m "feat: return 48x48 avatar url from users api"
```

---

## Task 4: Carry avatar through profile selection

**Files:**
- Modify: `src/components/profile/ProfileSetupModal.tsx`
- Modify: `src/components/profile/ProfileGate.tsx`

- [ ] **Step 1: Add avatarUrl to the modal's option type and callback**

In `src/components/profile/ProfileSetupModal.tsx`, update `JiraUserOption`:

```typescript
interface JiraUserOption {
  name: string;
  displayName: string;
  email: string;
  avatarUrl: string;
}
```

Update the props callback signature:

```typescript
interface ProfileSetupModalProps {
  onSelectProfile: (profile: { displayName: string; email: string; avatarUrl: string }) => void;
}
```

- [ ] **Step 2: Pass avatarUrl on confirm**

In the same file, update `handleConfirm`:

```typescript
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
```

- [ ] **Step 3: Store avatarUrl in ProfileGate**

In `src/components/profile/ProfileGate.tsx`, update the `ProfileState` interface:

```typescript
interface ProfileState {
  displayName: string;
  email: string;
  avatarUrl: string;
}
```

The existing `handleSelectProfile` already forwards the whole object to `writeProfileToDocumentCookie` and `setProfile`, so no logic change is needed — but confirm its signature accepts the new field (it uses `ProfileState`, so it does once the interface is updated).

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/profile/ProfileSetupModal.tsx src/components/profile/ProfileGate.tsx
git commit -m "feat: persist avatar url when selecting profile"
```

---

## Task 5: i18n keys

**Files:**
- Modify: `src/lib/i18n.tsx` (vi block near line 21, en block near line 232)

- [ ] **Step 1: Add Vietnamese keys**

In `src/lib/i18n.tsx`, in the `vi` translations object, after the line `'nav.hoursByDate': 'Thống kê số giờ log theo ngày',` add:

```javascript
    'nav.logout': 'Đăng xuất',
    'logout.title': 'Logging out',
    'logout.subtitle': 'See you again...',
```

- [ ] **Step 2: Add English keys**

In the `en` translations object, after its `'nav.hoursByDate': ...` line, add:

```javascript
    'nav.logout': 'Logout',
    'logout.title': 'Logging out',
    'logout.subtitle': 'See you again...',
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/i18n.tsx
git commit -m "feat: add logout i18n keys"
```

---

## Task 6: LogoutOverlay component

**Files:**
- Create: `src/components/layout/LogoutOverlay.tsx`

- [ ] **Step 1: Create the overlay component**

Create `src/components/layout/LogoutOverlay.tsx`:

```tsx
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
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/LogoutOverlay.tsx
git commit -m "feat: add logout overlay component"
```

---

## Task 7: UserBar component

**Files:**
- Create: `src/components/layout/UserBar.tsx`

- [ ] **Step 1: Create the UserBar component**

Create `src/components/layout/UserBar.tsx`:

```tsx
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
          className="absolute left-2 right-2 mt-1 rounded-xl z-[60] overflow-hidden"
          style={{
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
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/UserBar.tsx
git commit -m "feat: add user bar with logout dropdown"
```

---

## Task 8: Wire UserBar + LogoutOverlay into Sidebar

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Add imports**

In `src/components/layout/Sidebar.tsx`, after the `CreateTaskModal` import (line 7), add:

```tsx
import UserBar from '@/components/layout/UserBar';
import LogoutOverlay from '@/components/layout/LogoutOverlay';
```

- [ ] **Step 2: Add logout state**

Inside the `Sidebar` component, after `const [showCreateModal, setShowCreateModal] = useState(false);` (line 127), add:

```tsx
  const [loggingOut, setLoggingOut] = useState(false);
```

- [ ] **Step 3: Render the overlay**

At the top of the returned JSX, change:

```tsx
    <>
    {showCreateModal && <CreateTaskModal onClose={() => setShowCreateModal(false)} />}
```

to:

```tsx
    <>
    {showCreateModal && <CreateTaskModal onClose={() => setShowCreateModal(false)} />}
    {loggingOut && <LogoutOverlay />}
```

- [ ] **Step 4: Render UserBar between header and nav**

In the same file, locate the closing `</div>` of the header block (the one immediately before `<nav className="flex-1 py-3 px-2">`, around line 290). Insert the UserBar between them so it reads:

```tsx
      </div>
      <UserBar collapsed={collapsed} onLogout={() => setLoggingOut(true)} />
      <nav className="flex-1 py-3 px-2">
```

- [ ] **Step 5: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 6: Manual verification**

Run: `npm run dev`, open the app. Verify:
- User bar appears between the "Jira Dashboard" title and the menu, showing avatar + name + email.
- Avatar shows the Jira image for a freshly-selected user; shows initials for a pre-existing profile without an avatar cookie.
- Collapse the sidebar → bar shows only the centered avatar, still clickable.
- Click the bar → Logout dropdown appears; clicking outside closes it.
- Click Logout → full-screen "Logging out" / "See you again..." overlay shows ~1.2s, then the page reloads and the profile setup modal reappears (cookies cleared).
- Theme + language selections survive the logout reload.

- [ ] **Step 7: Commit**

```bash
git add src/components/layout/Sidebar.tsx
git commit -m "feat: wire user bar and logout overlay into sidebar"
```

---

## Self-Review Notes

- **Spec coverage:** cookie avatar (Task 1), users API avatar (Task 3), selection persistence (Task 4), UserBar with collapsed + initials fallback + dropdown (Task 7), LogoutOverlay clear+reload (Task 6), i18n (Task 5), wiring (Task 8), tests for pure logic (Tasks 1–2). All spec sections covered.
- **Type consistency:** `ProfileState` includes `avatarUrl` in ProfileGate and UserBar; `onSelectProfile`/`onLogout`/`collapsed` signatures match across files; cookie functions unchanged in name (`clearProfileDocumentCookie`, `readProfileFromDocumentCookie`, `writeProfileToDocumentCookie`).
- **Note on existing profiles:** users who set their profile before this feature have no `jira_avatar_url` cookie → `parseProfileCookieString` returns `avatarUrl: ''` → UserBar renders initials. Correct by design.
