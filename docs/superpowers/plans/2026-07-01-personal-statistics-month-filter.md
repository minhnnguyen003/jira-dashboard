# Personal Statistics — Month/Year Filter & JQL Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay thế saved filter cố định (ID 10244) bằng JQL động theo assignee email + tháng/năm được chọn, đồng thời bổ sung bộ lọc tháng/năm trên UI màn Personal Statistics.

**Architecture:** Tách logic build JQL ra file helper riêng (`src/lib/jira/personalJql.js`), extend route `/api/jira/search` nhận `personalMode` để dùng helper đó, cập nhật frontend thêm state tháng/năm và picker UI.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Node.js built-in test runner (`node:test`), React useState/useCallback/useEffect

---

## File Map

| File | Hành động | Trách nhiệm |
|---|---|---|
| `src/lib/jira/personalJql.js` | **Tạo mới** | Pure function build JQL string từ email + year + month |
| `src/lib/jira/personalJql.test.mjs` | **Tạo mới** | Unit tests cho JQL builder |
| `src/app/api/jira/search/route.ts` | **Sửa** | Thêm nhánh `personalMode` gọi JQL builder |
| `src/lib/i18n.tsx` | **Sửa** | Thêm 3 key mới, cập nhật `personal.workingDays` |
| `src/app/statistics/personal/page.tsx` | **Sửa** | State month/year, picker UI, refactor fetch functions |

---

## Task 1: JQL Builder — Viết test trước

**Files:**
- Tạo: `src/lib/jira/personalJql.test.mjs`

- [ ] **Step 1: Tạo file test**

```js
// src/lib/jira/personalJql.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPersonalJql } from './personalJql.js';

test('includes assignee email quoted', () => {
  const jql = buildPersonalJql('user@example.com', 2026, 7);
  assert.match(jql, /assignee = "user@example\.com"/);
});

test('formats startOfMonth as first day 00:00', () => {
  const jql = buildPersonalJql('user@example.com', 2026, 7);
  assert.match(jql, /"Start Date \(Time\)" >= "2026-07-01 00:00"/);
});

test('formats endOfMonth as last day 23:59 — July has 31 days', () => {
  const jql = buildPersonalJql('user@example.com', 2026, 7);
  assert.match(jql, /"Due Date \(Time\)" <= "2026-07-31 23:59"/);
});

test('handles February in leap year correctly', () => {
  const jql = buildPersonalJql('user@example.com', 2024, 2);
  assert.match(jql, /"Due Date \(Time\)" <= "2024-02-29 23:59"/);
});

test('handles February in non-leap year correctly', () => {
  const jql = buildPersonalJql('user@example.com', 2026, 2);
  assert.match(jql, /"Due Date \(Time\)" <= "2026-02-28 23:59"/);
});

test('includes labels and originalEstimate filters', () => {
  const jql = buildPersonalJql('user@example.com', 2026, 7);
  assert.match(jql, /labels NOT IN \(hashsubtask\)/);
  assert.match(jql, /originalEstimate IS NOT EMPTY/);
});

test('includes OR clause for tasks with empty start/due dates', () => {
  const jql = buildPersonalJql('user@example.com', 2026, 7);
  assert.match(jql, /"Start Date \(Time\)" IS EMPTY/);
  assert.match(jql, /"Due Date \(Time\)" IS EMPTY/);
});

test('zero-pads single-digit month', () => {
  const jql = buildPersonalJql('user@example.com', 2026, 3);
  assert.match(jql, /2026-03-01/);
});
```

- [ ] **Step 2: Chạy test — xác nhận FAIL (file chưa tồn tại)**

```bash
node --test src/lib/jira/personalJql.test.mjs
```

Expected: lỗi `Cannot find module './personalJql.js'`

---

## Task 2: JQL Builder — Implement

**Files:**
- Tạo: `src/lib/jira/personalJql.js`

- [ ] **Step 1: Tạo file implement**

```js
// src/lib/jira/personalJql.js

function pad(n) {
  return String(n).padStart(2, '0');
}

function jiraDate(year, month, day, time) {
  return `${year}-${pad(month)}-${pad(day)} ${time}`;
}

/**
 * Build JQL for personal statistics query.
 * @param {string} assigneeEmail
 * @param {number} year
 * @param {number} month  1-based (1 = January)
 * @returns {string}
 */
export function buildPersonalJql(assigneeEmail, year, month) {
  const lastDay = new Date(year, month, 0).getDate();
  const startOfMonth = jiraDate(year, month, 1, '00:00');
  const endOfMonth = jiraDate(year, month, lastDay, '23:59');

  return (
    `assignee = "${assigneeEmail}"\n` +
    `AND (\n` +
    `  (labels NOT IN (hashsubtask) OR labels IS EMPTY)\n` +
    `  AND originalEstimate IS NOT EMPTY\n` +
    `)\n` +
    `AND (\n` +
    `  (\n` +
    `    "Start Date (Time)" >= "${startOfMonth}"\n` +
    `    AND "Due Date (Time)" <= "${endOfMonth}"\n` +
    `  )\n` +
    `  OR (\n` +
    `    "Start Date (Time)" IS EMPTY\n` +
    `    OR "Due Date (Time)" IS EMPTY\n` +
    `  )\n` +
    `)\n` +
    `ORDER BY updated DESC`
  );
}
```

- [ ] **Step 2: Chạy test — xác nhận PASS**

```bash
node --test src/lib/jira/personalJql.test.mjs
```

Expected: tất cả 8 tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/jira/personalJql.js src/lib/jira/personalJql.test.mjs
git commit -m "feat: add personalJql builder with tests"
```

---

## Task 3: Extend `/api/jira/search` — Thêm personalMode

**Files:**
- Sửa: `src/app/api/jira/search/route.ts`

- [ ] **Step 1: Thêm import và logic `personalMode`**

Mở `src/app/api/jira/search/route.ts`. Thêm import ở đầu file (sau các import hiện có):

```ts
import { buildPersonalJql } from '@/lib/jira/personalJql.js';
```

Trong hàm `POST`, tìm đoạn parse body (hiện tại khoảng dòng 6–14):

```ts
const body = await request.json();
const startAt = parseInt(body.startAt || '0');
const maxResults = parseInt(body.maxResults || '50');
const groupBy = body.groupBy || 'assignee';
const assigneeEmails: string[] = body.assigneeEmails || [];
const queryId = body.queryId;
const statusGrouping = body.statusGrouping;
```

Thêm ngay sau:

```ts
const personalMode = body.personalMode === true;
const assigneeEmail: string = body.assigneeEmail || '';
const year = parseInt(body.year || String(new Date().getFullYear()));
const month = parseInt(body.month || String(new Date().getMonth() + 1));
```

Tìm đoạn build `jql` (hiện tại khoảng dòng 15–19):

```ts
let jql: string;
if (typeof queryId === 'string' && /^\d+$/.test(queryId)) {
  jql = await getSavedQueryJQL(queryId);
} else {
  jql = body.jql || 'project = YOUR_PROJECT ORDER BY updated DESC';
}
```

Thay bằng:

```ts
let jql: string;
if (personalMode && assigneeEmail) {
  jql = buildPersonalJql(assigneeEmail, year, month);
} else if (typeof queryId === 'string' && /^\d+$/.test(queryId)) {
  jql = await getSavedQueryJQL(queryId);
} else {
  jql = body.jql || 'project = YOUR_PROJECT ORDER BY updated DESC';
}
```

- [ ] **Step 2: Kiểm tra TypeScript compile**

```bash
npx tsc --noEmit
```

Expected: không có lỗi type

- [ ] **Step 3: Commit**

```bash
git add src/app/api/jira/search/route.ts
git commit -m "feat: extend search route with personalMode JQL builder"
```

---

## Task 4: i18n — Thêm keys mới

**Files:**
- Sửa: `src/lib/i18n.tsx`

- [ ] **Step 1: Thêm keys vào translations.vi**

Mở `src/lib/i18n.tsx`. Tìm block `vi: {` → tìm dòng `'personal.filterStatus'`. Thêm ngay TRƯỚC dòng đó:

```ts
'personal.monthLabel': 'Tháng',
'personal.yearLabel': 'Năm',
'personal.noEmailError': 'Không tìm thấy thông tin người dùng. Vui lòng đăng nhập lại.',
```

Tìm dòng (trong `vi`):

```ts
'personal.workingDays': 'Số ngày làm việc tháng này: {days}',
```

Thay bằng:

```ts
'personal.workingDays': 'Số ngày làm việc tháng {month}/{year}: {days}',
```

- [ ] **Step 2: Thêm keys vào translations.en**

Tìm block `en: {` → tìm dòng `'personal.filterStatus'`. Thêm ngay TRƯỚC dòng đó:

```ts
'personal.monthLabel': 'Month',
'personal.yearLabel': 'Year',
'personal.noEmailError': 'User profile not found. Please log in again.',
```

Tìm dòng (trong `en`):

```ts
'personal.workingDays': 'Working days this month: {days}',
```

Thay bằng:

```ts
'personal.workingDays': 'Working days {month}/{year}: {days}',
```

- [ ] **Step 3: Kiểm tra TypeScript compile**

```bash
npx tsc --noEmit
```

Expected: không có lỗi — nếu TypeScript báo thiếu key, xem lại `TranslationKey` type được infer từ `translations.vi`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/i18n.tsx
git commit -m "feat: add personal statistics i18n keys for month/year filter"
```

---

## Task 5: Frontend — Refactor fetch functions + thêm state

**Files:**
- Sửa: `src/app/statistics/personal/page.tsx`

- [ ] **Step 1: Thêm import `readProfileFromDocumentCookie`**

Thêm vào đầu file (sau các import hiện có):

```ts
import { readProfileFromDocumentCookie } from '@/lib/profile-cookie.js';
```

- [ ] **Step 2: Thêm state month/year**

Trong component, ngay sau dòng `const [showLogWorkModal, setShowLogWorkModal] = useState(false);`, thêm:

```ts
const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth() + 1);
const [selectedYear, setSelectedYear]   = useState(() => new Date().getFullYear());
```

- [ ] **Step 3: Refactor `fetchWorkingDays` nhận month/year**

Thay toàn bộ hàm `fetchWorkingDays` hiện tại:

```ts
const fetchWorkingDays = useCallback(async (month: number, year: number) => {
  setCalendarLoading(true);
  try {
    const params = new URLSearchParams({
      year: String(year),
      month: String(month),
    });
    const res = await fetch(`/api/calendar/vn-working-days?${params.toString()}`);
    if (!res.ok) throw new Error(`Calendar API error: ${res.status}`);
    setWorkingDayData(await res.json());
  } catch {
    setWorkingDayData(null);
  } finally {
    setCalendarLoading(false);
  }
}, []);
```

- [ ] **Step 4: Refactor `fetchData` nhận month/year, đọc email từ cookie**

Thay toàn bộ hàm `fetchData` hiện tại:

```ts
const fetchData = useCallback(async (month: number, year: number) => {
  setLoading(true);
  setError(null);

  const profile = readProfileFromDocumentCookie();
  if (!profile?.email) {
    setError(t('personal.noEmailError'));
    setLoading(false);
    return;
  }

  try {
    const res = await fetch('/api/jira/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalMode: true,
        assigneeEmail: profile.email,
        year,
        month,
        groupBy: 'status',
        statusGrouping: 'personal',
        startAt: 0,
        maxResults,
      }),
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);

    const payload = (await res.json()) as DashboardData;
    setData({
      ...payload,
      aggregated: sortGroupedStatus(payload.aggregated),
    });
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Failed to fetch data');
  } finally {
    setLoading(false);
  }
}, [maxResults, t]);
```

- [ ] **Step 5: Cập nhật useEffect**

Tìm và thay `useEffect` hiện tại:

```ts
useEffect(() => {
  const timer = window.setTimeout(() => {
    void fetchWorkingDays();
    void fetchData();
  }, 0);

  return () => window.clearTimeout(timer);
}, [fetchData, fetchWorkingDays]);
```

Thay bằng:

```ts
useEffect(() => {
  const timer = window.setTimeout(() => {
    void fetchWorkingDays(selectedMonth, selectedYear);
    void fetchData(selectedMonth, selectedYear);
  }, 0);

  return () => window.clearTimeout(timer);
}, [fetchData, fetchWorkingDays, selectedMonth, selectedYear]);
```

- [ ] **Step 6: Cập nhật `handleRefreshTask` gọi fetchData với tham số**

Tìm trong `handleRefreshTask`:

```ts
const refreshPromise = fetchData();
```

Thay bằng:

```ts
const refreshPromise = fetchData(selectedMonth, selectedYear);
```

Tìm trong `handleLogWorkSuccess`:

```ts
await fetchData();
```

Thay bằng:

```ts
await fetchData(selectedMonth, selectedYear);
```

- [ ] **Step 7: Cập nhật hiển thị workingDays — thêm month/year params**

Tìm dòng:

```tsx
{t('personal.workingDays', { days: String(workingDayData.workingDays) })}
```

Thay bằng:

```tsx
{t('personal.workingDays', {
  days: String(workingDayData.workingDays),
  month: String(selectedMonth).padStart(2, '0'),
  year: String(selectedYear),
})}
```

- [ ] **Step 8: Kiểm tra TypeScript compile**

```bash
npx tsc --noEmit
```

Expected: không có lỗi

- [ ] **Step 9: Commit**

```bash
git add src/app/statistics/personal/page.tsx
git commit -m "feat: refactor personal stats fetch to use month/year params and personalMode JQL"
```

---

## Task 6: Frontend — Thêm Month/Year Picker UI

**Files:**
- Sửa: `src/app/statistics/personal/page.tsx`

- [ ] **Step 1: Thêm picker UI sau savedFilterInfo**

Tìm block JSX hiện tại (khoảng dòng 224–241):

```tsx
<div className="mb-6 animate-slide-up" style={{ animationDelay: '0.08s' }}>
  <div className="flex flex-wrap items-center gap-3 mt-2">
    <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
      {t('personal.savedFilterInfo')}
    </p>
    {workingDayData && (
```

Thêm picker ngay sau thẻ `<p>` chứa `savedFilterInfo`:

```tsx
<div className="mb-6 animate-slide-up" style={{ animationDelay: '0.08s' }}>
  <div className="flex flex-wrap items-center gap-3 mt-2">
    <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
      {t('personal.savedFilterInfo')}
    </p>
  </div>

  <div className="flex items-center gap-2 mt-3">
    <label className="text-xs" style={{ color: 'var(--text-dim)' }}>
      {t('personal.monthLabel')}
    </label>
    <select
      className="glass-select px-3 py-1.5 text-sm"
      value={selectedMonth}
      onChange={(e) => setSelectedMonth(Number(e.target.value))}
    >
      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
        <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
      ))}
    </select>

    <label className="text-xs" style={{ color: 'var(--text-dim)' }}>
      {t('personal.yearLabel')}
    </label>
    <select
      className="glass-select px-3 py-1.5 text-sm"
      value={selectedYear}
      onChange={(e) => setSelectedYear(Number(e.target.value))}
    >
      {[-2, -1, 0, 1].map((offset) => {
        const y = new Date().getFullYear() + offset;
        return <option key={y} value={y}>{y}</option>;
      })}
    </select>
  </div>

  <div className="flex flex-wrap items-center gap-3 mt-2">
    {workingDayData && (
```

> **Lưu ý:** Dòng `{workingDayData && (` trở về sau giữ nguyên từ code cũ, chỉ dịch chuyển vào block `mt-2` mới ở cuối.

- [ ] **Step 2: Kiểm tra TypeScript compile**

```bash
npx tsc --noEmit
```

Expected: không có lỗi

- [ ] **Step 3: Chạy dev server và kiểm tra thủ công**

```bash
npm run dev
```

Mở `http://localhost:3000/statistics/personal` và kiểm tra:
- [ ] Picker tháng/năm hiển thị đúng vị trí (dưới `savedFilterInfo`, trước chart)
- [ ] Default là tháng và năm hiện tại
- [ ] Đổi tháng → data và working days reload
- [ ] Đổi năm → data và working days reload
- [ ] Text working days hiển thị đúng format `tháng MM/YYYY: X ngày`
- [ ] Không có email cookie → hiện error banner thay vì crash

- [ ] **Step 4: Commit**

```bash
git add src/app/statistics/personal/page.tsx
git commit -m "feat: add month/year picker UI to personal statistics page"
```

---

## Spec Coverage Check

| Requirement | Task |
|---|---|
| JQL mới với assignee email | Task 2, Task 3 |
| `originalEstimate IS NOT EMPTY` | Task 2 |
| `labels NOT IN (hashsubtask)` | Task 2 |
| Date range theo tháng/năm chọn | Task 2 |
| OR clause cho task không có startDate/dueDate | Task 2 |
| Format date `"yyyy-MM-dd HH:mm"` | Task 2 |
| Email từ cookie | Task 5 |
| Month/year picker UI dưới `savedFilterInfo` | Task 6 |
| Picker mặc định tháng/năm hiện tại | Task 6 |
| Auto-fetch khi đổi tháng/năm | Task 5 |
| Working days cập nhật theo tháng/năm | Task 5 |
| i18n keys mới | Task 4 |
| Convention `glass-select` | Task 6 |
