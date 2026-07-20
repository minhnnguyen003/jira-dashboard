# Browse Tasks Assignee Combobox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay `select` Assignee ở `/browse-tasks` bằng combobox tìm kiếm client-side trên toàn bộ danh sách người dùng được tải ngầm một lần khi trang mount.

**Architecture:** Route users dùng helper phân trang độc lập để gom, chuẩn hóa và loại trùng toàn bộ Jira users. Một helper thuần xử lý lọc/khớp chính xác, còn component `AssigneeCombobox` quản lý query, dropdown, keyboard và blur; trang chỉ giữ users, trạng thái tải/lỗi và draft assignee hợp lệ.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript/JavaScript ES modules, Node.js built-in test runner, ESLint.

## Global Constraints

- Không thêm dependency mới.
- Không hỗ trợ chọn nhiều assignee.
- Không gọi Jira tìm kiếm theo từng ký tự.
- Không cache danh sách users qua lần reload trang hoặc giữa nhiều tab.
- Không thay đổi JQL phía `/api/jira/browse-tasks`.
- Mọi query client-side phải trim và so khớp không phân biệt hoa thường theo `displayName`, `name`, `email`.
- Draft không hợp lệ không bao giờ được gửi sang Jira; `All` được biểu diễn bằng chuỗi rỗng.

---

## File Structure

- Create `src/app/api/jira/users/userPagination.js`: gom trang, chuẩn hóa và loại trùng users, không phụ thuộc Axios/Next.js.
- Create `src/app/api/jira/users/userPagination.test.mjs`: kiểm thử nhiều trang, loại trùng và lỗi dữ liệu.
- Modify `src/app/api/jira/users/route.ts`: dùng helper để trả toàn bộ users khi có `all=true`, giữ tìm kiếm giới hạn hiện tại cho consumer cũ.
- Create `src/components/form/assigneeCombobox.js`: hàm thuần lọc và resolve input khi blur.
- Create `src/components/form/assigneeCombobox.test.mjs`: kiểm thử lọc, exact match và fallback `All`.
- Create `src/components/form/AssigneeCombobox.tsx`: UI combobox accessible và xử lý bàn phím.
- Modify `src/app/browse-tasks/page.tsx`: thay `select`, tải users một lần với `all=true`, giữ lỗi users độc lập.
- Modify `src/lib/i18n.tsx`: thêm copy loading/empty/error/placeholder cho hai ngôn ngữ.
- Modify `src/app/browse-tasks/browseFilterPanel.test.mjs`: khóa integration và đảm bảo không search users theo input.

---

### Task 1: Phân trang toàn bộ Jira users

**Files:**
- Create: `src/app/api/jira/users/userPagination.js`
- Create: `src/app/api/jira/users/userPagination.test.mjs`
- Modify: `src/app/api/jira/users/route.ts`

**Interfaces:**
- Consumes: `fetchPage({ startAt, maxResults }): Promise<unknown>` do route bọc quanh Axios.
- Produces: `fetchAllJiraUsers(fetchPage, pageSize = 100): Promise<Array<{name:string, displayName:string, email:string, avatarUrl:string}>>`.

- [ ] **Step 1: Viết test thất bại cho phân trang và loại trùng**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchAllJiraUsers } from './userPagination.js';

test('fetches every page, normalizes users, and removes duplicate identities', async () => {
  const calls = [];
  const pages = [
    [
      { name: 'minh', displayName: 'Minh', emailAddress: 'minh@etc.vn', avatarUrls: { '48x48': 'minh.png' } },
      { name: 'an', displayName: 'An', emailAddress: 'an@etc.vn' },
    ],
    [
      { name: 'AN-OLD', displayName: 'An duplicate', emailAddress: 'AN@ETC.VN' },
      { name: 'binh' },
    ],
    [],
  ];
  const users = await fetchAllJiraUsers(async ({ startAt, maxResults }) => {
    calls.push({ startAt, maxResults });
    return pages.shift();
  }, 2);

  assert.deepEqual(calls, [
    { startAt: 0, maxResults: 2 },
    { startAt: 2, maxResults: 2 },
    { startAt: 4, maxResults: 2 },
  ]);
  assert.deepEqual(users, [
    { name: 'minh', displayName: 'Minh', email: 'minh@etc.vn', avatarUrl: 'minh.png' },
    { name: 'an', displayName: 'An', email: 'an@etc.vn', avatarUrl: '' },
    { name: 'binh', displayName: 'binh', email: 'binh', avatarUrl: '' },
  ]);
});

test('rejects a non-array Jira response instead of returning a partial list', async () => {
  await assert.rejects(
    () => fetchAllJiraUsers(async () => ({ error: 'bad response' }), 100),
    /Expected Jira users page to be an array/,
  );
});
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `node --test src/app/api/jira/users/userPagination.test.mjs`

Expected: FAIL với `ERR_MODULE_NOT_FOUND` cho `userPagination.js`.

- [ ] **Step 3: Implement helper tối thiểu**

```js
function normalizeUser(user) {
  const name = typeof user?.name === 'string' ? user.name : '';
  const email = typeof user?.emailAddress === 'string' && user.emailAddress ? user.emailAddress : name;
  return {
    name,
    displayName: typeof user?.displayName === 'string' && user.displayName ? user.displayName : name,
    email,
    avatarUrl: user?.avatarUrls?.['48x48'] || '',
  };
}

export async function fetchAllJiraUsers(fetchPage, pageSize = 100) {
  const users = [];
  const seen = new Set();
  let startAt = 0;

  while (true) {
    const page = await fetchPage({ startAt, maxResults: pageSize });
    if (!Array.isArray(page)) throw new TypeError('Expected Jira users page to be an array');

    for (const rawUser of page) {
      const user = normalizeUser(rawUser);
      const identity = (user.email || user.name).trim().toLocaleLowerCase();
      if (!identity || seen.has(identity)) continue;
      seen.add(identity);
      users.push(user);
    }

    if (page.length === 0) break;
    startAt += page.length;
  }

  return users;
}
```

Trong `route.ts`, import helper, đọc `all`, và thay khối request/map bằng nhánh sau. Nhánh không `all` giữ `query` và giới hạn 20 để không làm thay đổi màn Create Task:

```ts
import { fetchAllJiraUsers } from './userPagination.js';

const all = searchParams.get('all') === 'true';

if (all) {
  const users = await fetchAllJiraUsers(async ({ startAt, maxResults }) => {
    const response = await axiosInstance.get('/rest/api/2/user/search', {
      params: {
        username: '',
        search: '',
        startAt: String(startAt),
        maxResults: String(maxResults),
      },
      headers: getAuthHeaders(),
    });
    return response.data;
  });
  return NextResponse.json(users);
}

const response = await axiosInstance.get('/rest/api/2/user/search', {
  params: { username: query, ...(query ? { search: query } : {}), maxResults: '20' },
  headers: getAuthHeaders(),
});
return NextResponse.json(normalizeJiraUsers(response.data));
```

Import thêm `normalizeJiraUsers` từ helper để nhánh tìm kiếm chỉ chuẩn hóa đúng một trang. Cập nhật helper bằng implementation cụ thể:

```js
export function normalizeJiraUsers(rawUsers) {
  if (!Array.isArray(rawUsers)) throw new TypeError('Expected Jira users page to be an array');
  const seen = new Set();
  return rawUsers.map(normalizeUser).filter((user) => {
    const identity = (user.email || user.name).trim().toLocaleLowerCase();
    if (!identity || seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}

export async function fetchAllJiraUsers(fetchPage, pageSize = 100) {
  const users = [];
  const seen = new Set();
  let startAt = 0;
  while (true) {
    const rawPage = await fetchPage({ startAt, maxResults: pageSize });
    const page = normalizeJiraUsers(rawPage);
    for (const user of page) {
      const identity = (user.email || user.name).trim().toLocaleLowerCase();
      if (!seen.has(identity)) { seen.add(identity); users.push(user); }
    }
    if (rawPage.length === 0) break;
    startAt += rawPage.length;
  }
  return users;
}
```

- [ ] **Step 4: Chạy test API helper và lint route**

Run: `node --test src/app/api/jira/users/userPagination.test.mjs && npm run lint -- src/app/api/jira/users/route.ts src/app/api/jira/users/userPagination.js`

Expected: tất cả test PASS và ESLint không có error.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/jira/users/route.ts src/app/api/jira/users/userPagination.js src/app/api/jira/users/userPagination.test.mjs
git commit -m "feat: load all Jira users by page"
```

---

### Task 2: Logic lọc và fallback của combobox

**Files:**
- Create: `src/components/form/assigneeCombobox.js`
- Create: `src/components/form/assigneeCombobox.test.mjs`

**Interfaces:**
- Consumes: user `{ name, displayName, email }` và query string.
- Produces: `filterAssigneeUsers(users, query)` và `resolveAssigneeInput(users, query)`; resolve trả user hoặc `null` (`All`).

- [ ] **Step 1: Viết test thất bại cho filter và blur resolution**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { filterAssigneeUsers, resolveAssigneeInput } from './assigneeCombobox.js';

const users = [
  { name: 'minh.nguyen', displayName: 'Minh Nguyễn', email: 'minh@etc.vn' },
  { name: 'an.tran', displayName: 'An Trần', email: 'an@etc.vn' },
];

test('filters locally across display name, username, and email without case sensitivity', () => {
  assert.deepEqual(filterAssigneeUsers(users, '  NGUYỄN '), [users[0]]);
  assert.deepEqual(filterAssigneeUsers(users, 'AN.TR'), [users[1]]);
  assert.deepEqual(filterAssigneeUsers(users, '@ETC.VN'), users);
});

test('resolves exact username or email on blur', () => {
  assert.equal(resolveAssigneeInput(users, ' MINH.NGUYEN '), users[0]);
  assert.equal(resolveAssigneeInput(users, 'AN@ETC.VN'), users[1]);
});

test('falls back to All for partial, unknown, or empty input', () => {
  assert.equal(resolveAssigneeInput(users, 'minh'), null);
  assert.equal(resolveAssigneeInput(users, 'unknown'), null);
  assert.equal(resolveAssigneeInput(users, '  '), null);
});
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `node --test src/components/form/assigneeCombobox.test.mjs`

Expected: FAIL với `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement các hàm thuần**

```js
function normalize(value) {
  return String(value || '').trim().toLocaleLowerCase();
}

export function filterAssigneeUsers(users, query) {
  const needle = normalize(query);
  if (!needle) return users;
  return users.filter((user) => [user.displayName, user.name, user.email]
    .some((value) => normalize(value).includes(needle)));
}

export function resolveAssigneeInput(users, query) {
  const needle = normalize(query);
  if (!needle) return null;
  return users.find((user) => normalize(user.name) === needle || normalize(user.email) === needle) || null;
}
```

- [ ] **Step 4: Chạy test và lint helper**

Run: `node --test src/components/form/assigneeCombobox.test.mjs && npm run lint -- src/components/form/assigneeCombobox.js`

Expected: 3 test PASS và ESLint không có error.

- [ ] **Step 5: Commit**

```bash
git add src/components/form/assigneeCombobox.js src/components/form/assigneeCombobox.test.mjs
git commit -m "test: define assignee combobox matching"
```

---

### Task 3: Component AssigneeCombobox accessible

**Files:**
- Create: `src/components/form/AssigneeCombobox.tsx`
- Modify: `src/lib/i18n.tsx`

**Interfaces:**
- Consumes props `users`, `value`, `loading`, `error`, `onChange` và bản dịch qua `useLanguage`.
- Produces `onChange('')` cho `All` hoặc `onChange(user.email || user.name)` cho user hợp lệ.

- [ ] **Step 1: Bổ sung test cấu trúc component trước khi tạo file**

Tạo `src/components/form/AssigneeCombobox.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.join(process.cwd(), 'src/components/form/AssigneeCombobox.tsx'), 'utf8');

test('exposes accessible combobox and listbox semantics', () => {
  assert.match(source, /role="combobox"/);
  assert.match(source, /aria-autocomplete="list"/);
  assert.match(source, /role="listbox"/);
  assert.match(source, /role="option"/);
  assert.match(source, /onKeyDown=/);
  assert.match(source, /resolveAssigneeInput/);
});
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `node --test src/components/form/AssigneeCombobox.test.mjs`

Expected: FAIL với `ENOENT` cho component chưa tồn tại.

- [ ] **Step 3: Tạo component với state và event đầy đủ**

Implement `AssigneeCombobox.tsx` với:

```tsx
'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { useLanguage } from '@/lib/i18n';
import { filterAssigneeUsers, resolveAssigneeInput } from './assigneeCombobox.js';

export interface AssigneeOption { name: string; displayName: string; email: string; avatarUrl?: string }
interface Props {
  users: AssigneeOption[];
  value: string;
  loading: boolean;
  error: boolean;
  onChange: (value: string) => void;
}

export default function AssigneeCombobox({ users, value, loading, error, onChange }: Props) {
  const { t } = useLanguage();
  const listboxId = useId();
  const selected = users.find((user) => (user.email || user.name) === value) || null;
  const [query, setQuery] = useState(selected?.displayName || '');
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const filtered = useMemo(() => filterAssigneeUsers(users, query), [users, query]);

  useEffect(() => { setQuery(selected?.displayName || ''); }, [selected?.displayName]);
  useEffect(() => { setHighlighted(0); }, [query]);

  const choose = (user: AssigneeOption | null) => {
    onChange(user ? user.email || user.name : '');
    setQuery(user?.displayName || '');
    setOpen(false);
  };
  const handleBlur = () => {
    window.setTimeout(() => {
      const exact = resolveAssigneeInput(users, query);
      choose(exact);
    }, 0);
  };
  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); setOpen(true);
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      setHighlighted((current) => filtered.length ? (current + delta + filtered.length) % filtered.length : 0);
    } else if (event.key === 'Enter' && open && filtered[highlighted]) {
      event.preventDefault(); choose(filtered[highlighted]);
    } else if (event.key === 'Escape') {
      setOpen(false); setQuery(selected?.displayName || '');
    }
  };

  return (
    <div className="relative">
      <input
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={open && filtered[highlighted] ? `${listboxId}-${highlighted}` : undefined}
        value={query}
        placeholder={t('browseTasks.assigneePlaceholder')}
        className="input-field w-full px-3 py-2 text-sm"
        onFocus={() => setOpen(true)}
        onChange={(event) => { setQuery(event.target.value); setOpen(true); if (!event.target.value) onChange(''); }}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
      />
      {open && (
        <div id={listboxId} role="listbox" className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-xl p-1" style={{ background: 'var(--dropdown-bg)', border: '1px solid var(--border)' }}>
          {loading ? <div className="px-3 py-2 text-sm">{t('browseTasks.assigneeLoading')}</div>
            : error ? <div className="px-3 py-2 text-sm">{t('browseTasks.assigneeError')}</div>
              : filtered.length === 0 ? <div className="px-3 py-2 text-sm">{t('browseTasks.assigneeEmpty')}</div>
                : filtered.map((user, index) => (
                  <button
                    id={`${listboxId}-${index}`}
                    key={user.email || user.name}
                    type="button"
                    role="option"
                    aria-selected={index === highlighted}
                    className="flex w-full flex-col rounded-lg px-3 py-2 text-left"
                    onMouseEnter={() => setHighlighted(index)}
                    onMouseDown={(event) => { event.preventDefault(); choose(user); }}
                  >
                    <span className="text-sm">{user.displayName}</span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{user.email || user.name}</span>
                  </button>
                ))}
        </div>
      )}
    </div>
  );
}
```

Thêm cả hai locale:

```ts
'browseTasks.assigneePlaceholder': 'Tất cả',
'browseTasks.assigneeLoading': 'Đang tải người dùng...',
'browseTasks.assigneeEmpty': 'Không tìm thấy người dùng',
'browseTasks.assigneeError': 'Không tải được danh sách người dùng',
```

```ts
'browseTasks.assigneePlaceholder': 'All',
'browseTasks.assigneeLoading': 'Loading users...',
'browseTasks.assigneeEmpty': 'No users found',
'browseTasks.assigneeError': 'Could not load users',
```

- [ ] **Step 4: Chạy test, typecheck và lint component**

Run: `node --test src/components/form/AssigneeCombobox.test.mjs src/components/form/assigneeCombobox.test.mjs && npx tsc --noEmit && npm run lint -- src/components/form/AssigneeCombobox.tsx src/lib/i18n.tsx`

Expected: tất cả test PASS, TypeScript và ESLint không có error.

- [ ] **Step 5: Commit**

```bash
git add src/components/form/AssigneeCombobox.tsx src/components/form/AssigneeCombobox.test.mjs src/lib/i18n.tsx
git commit -m "feat: add searchable assignee combobox"
```

---

### Task 4: Tích hợp combobox vào Browse Tasks

**Files:**
- Modify: `src/app/browse-tasks/page.tsx`
- Modify: `src/app/browse-tasks/browseFilterPanel.test.mjs`

**Interfaces:**
- Consumes: `AssigneeCombobox`, `/api/jira/users?all=true`, filter value `email || name`.
- Produces: request `/api/jira/browse-tasks` không có assignee khi `value === ''`, giữ nguyên contract hiện tại khi có user hợp lệ.

- [ ] **Step 1: Viết integration test thất bại**

Thêm vào `browseFilterPanel.test.mjs`:

```js
test('loads all users once and delegates local filtering to the assignee combobox', () => {
  assert.match(source, /import AssigneeCombobox from '@\/components\/form\/AssigneeCombobox'/);
  assert.match(source, /fetch\('\/api\/jira\/users\?all=true'\)/);
  assert.match(source, /<AssigneeCombobox[\s\S]*users=\{users\}[\s\S]*onChange=/);
  assert.doesNotMatch(source, /users\?query=/);
  assert.doesNotMatch(source, /<select[\s\S]{0,300}filters\.assignee/);
});

test('keeps users loading and errors independent from task loading and errors', () => {
  assert.match(source, /const \[usersLoading, setUsersLoading\]/);
  assert.match(source, /const \[usersError, setUsersError\]/);
});
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `node --test src/app/browse-tasks/browseFilterPanel.test.mjs`

Expected: các test mới FAIL vì chưa import/render combobox và chưa có users state.

- [ ] **Step 3: Tích hợp component và request mount một lần**

Trong `page.tsx`:

```tsx
import AssigneeCombobox from '@/components/form/AssigneeCombobox';

const [usersLoading, setUsersLoading] = useState(true);
const [usersError, setUsersError] = useState(false);

// Trong mount effect, thay fetch users hiện tại:
fetch('/api/jira/users?all=true')
  .then((response) => {
    if (!response.ok) throw new Error(`Users API error: ${response.status}`);
    return response.json();
  })
  .then((data) => setUsers(Array.isArray(data) ? data : []))
  .catch(() => setUsersError(true))
  .finally(() => setUsersLoading(false));
```

Mở rộng props `FilterPanel` bằng `usersLoading` và `usersError`, rồi thay toàn bộ `select` assignee bằng:

```tsx
<AssigneeCombobox
  users={users}
  value={filters.assignee}
  loading={usersLoading}
  error={usersError}
  onChange={(assignee) => setFilters((prev) => ({ ...prev, assignee }))}
/>
```

Truyền hai prop mới từ `BrowseTasksPage`. Không thay `fetchTasks`: điều kiện `if (f.assignee) params.set('assignee', f.assignee)` đã bảo đảm `All` không gửi tham số.

- [ ] **Step 4: Chạy toàn bộ verification liên quan**

Run: `node --test src/app/api/jira/users/userPagination.test.mjs src/components/form/assigneeCombobox.test.mjs src/components/form/AssigneeCombobox.test.mjs src/app/browse-tasks/browseFilterPanel.test.mjs`

Expected: tất cả test PASS.

Run: `npx tsc --noEmit && npm run lint -- src/app/api/jira/users/route.ts src/app/api/jira/users/userPagination.js src/components/form/assigneeCombobox.js src/components/form/AssigneeCombobox.tsx src/app/browse-tasks/page.tsx src/lib/i18n.tsx`

Expected: TypeScript và ESLint không có error.

Run: `npm run build`

Expected: Next.js production build hoàn tất thành công.

- [ ] **Step 5: Commit integration**

```bash
git add src/app/browse-tasks/page.tsx src/app/browse-tasks/browseFilterPanel.test.mjs
git commit -m "feat: filter browse tasks by cached assignee list"
```

---

## Final Manual Verification

- [ ] Mở `/browse-tasks`; xác nhận task render độc lập trong lúc users còn tải ngầm.
- [ ] Mở filter; focus Assignee và xác nhận dropdown hiển thị danh sách dài.
- [ ] Gõ một phần tên/email; xác nhận danh sách đổi ngay và Network không có request users mới.
- [ ] Chọn bằng chuột, Arrow keys + Enter; bấm **Áp dụng** và xác nhận request task có assignee đúng.
- [ ] Nhập chính xác username/email rồi blur; xác nhận user được chọn.
- [ ] Nhập chuỗi một phần nhưng không chọn rồi blur; xác nhận ô trở về `All`.
- [ ] Xóa input; xác nhận `All` và request tiếp theo không có assignee.
- [ ] Nhấn Escape; xác nhận dropdown đóng và selection trước đó được khôi phục.
- [ ] Giả lập users API lỗi; xác nhận Assignee báo lỗi nhưng task và các bộ lọc khác vẫn hoạt động.
