# ESLint Baseline Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Loại bỏ toàn bộ 60 ESLint errors hiện hữu mà không hạ rule severity, không đổi API contract hoặc hành vi UI.

**Architecture:** Sửa theo bốn ranh giới review độc lập: helper chuẩn hóa lỗi Axios, kiểu Jira response/payload phức tạp, state lifecycle của các React component, và ref/mutation riêng trong `TaskDetailModal`. Mỗi task giữ thay đổi tối thiểu, chạy test/typecheck/lint mục tiêu và commit riêng.

**Tech Stack:** Next.js 16, React 19, TypeScript, Axios 1.17, ESLint 9 với eslint-config-next 16, Node.js test runner.

## Global Constraints

- Không thêm hoặc nâng/hạ dependency.
- Không sửa `eslint.config.mjs`, không thêm ESLint disable comment và không hạ severity rule.
- Giữ nguyên HTTP status, JSON response shape và message contract của API routes.
- Giữ nguyên hành vi nhìn thấy, timing debounce, defaults và props contract của UI.
- Không mở rộng sang 23 warnings hiện hữu trừ khi warning nằm đúng dòng phải sửa và có thể loại bỏ không đổi hành vi.
- Kết thúc remediation phải chạy `node --test`, `npx tsc --noEmit`, `npm run lint` và `npm run build` thành công trước khi triển khai combobox.

---

### Task 1: Chuẩn hóa error handling cho Jira API routes

**Files:**
- Create: `src/lib/jira/apiError.ts`
- Create: `src/lib/jira/apiError.test.mjs`
- Modify: `src/app/api/jira/avatar/route.ts`
- Modify: `src/app/api/jira/components/route.ts`
- Modify: `src/app/api/jira/edit-meta/route.ts`
- Modify: `src/app/api/jira/epics/route.ts`
- Modify: `src/app/api/jira/issue-types/route.ts`
- Modify: `src/app/api/jira/log-work/route.ts`
- Modify: `src/app/api/jira/projects/route.ts`
- Modify: `src/app/api/jira/sprints/route.ts`
- Modify: `src/app/api/jira/statuses/route.ts`
- Modify: `src/app/api/jira/tasks/route.ts`
- Modify: `src/app/api/jira/transitions/route.ts`
- Modify: `src/app/api/jira/update-issue/route.ts`
- Modify: `src/app/api/jira/users/route.ts`
- Modify: `src/lib/jira/api.ts`

**Interfaces:**
- Produces `getJiraErrorDetails(error: unknown): { status: string | number; detail: unknown }`.
- API routes consume helper only trong catch; response status và message format giữ nguyên tại từng route.

- [ ] **Step 1: Viết failing test cho helper**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { getJiraErrorDetails } from './apiError.ts';

test('extracts status and detail from an Axios-shaped error', () => {
  const error = { isAxiosError: true, response: { status: 403, data: { message: 'Forbidden' } }, message: 'fallback' };
  assert.deepEqual(getJiraErrorDetails(error), { status: 403, detail: { message: 'Forbidden' } });
});

test('falls back to Error message and UNKNOWN status', () => {
  assert.deepEqual(getJiraErrorDetails(new Error('boom')), { status: 'UNKNOWN', detail: 'boom' });
});

test('handles non-Error thrown values', () => {
  assert.deepEqual(getJiraErrorDetails('boom'), { status: 'UNKNOWN', detail: 'boom' });
});
```

Nếu Node runner không import `.ts` trực tiếp trong môi trường hiện tại, tạo helper runtime tại `apiError.js` và file declaration/type annotations qua JSDoc; test phải import đúng file runtime giống pattern helper `.js` hiện hữu.

- [ ] **Step 2: Chạy test đỏ**

Run: `node --test src/lib/jira/apiError.test.mjs`

Expected: FAIL vì helper chưa tồn tại.

- [ ] **Step 3: Implement helper và thay catch annotations**

Implementation contract:

```ts
import axios from 'axios';

export function getJiraErrorDetails(error: unknown): { status: string | number; detail: unknown } {
  if (axios.isAxiosError(error)) {
    return {
      status: error.response?.status ?? error.code ?? 'UNKNOWN',
      detail: error.response?.data ?? error.message,
    };
  }
  return {
    status: 'UNKNOWN',
    detail: error instanceof Error ? error.message : error,
  };
}
```

Trong mỗi route, thay `catch (error: any)` bằng `catch (error: unknown)`, gọi helper, rồi giữ nguyên template message/response đang có. Trong `src/lib/jira/api.ts`, dùng helper hoặc local `axios.isAxiosError` nếu hàm cần throw message riêng; không thay signature export.

- [ ] **Step 4: Verify task**

Run: `node --test src/lib/jira/apiError.test.mjs && npx tsc --noEmit && npx eslint src/lib/jira/apiError.ts src/app/api/jira/avatar/route.ts src/app/api/jira/components/route.ts src/app/api/jira/edit-meta/route.ts src/app/api/jira/epics/route.ts src/app/api/jira/issue-types/route.ts src/app/api/jira/log-work/route.ts src/app/api/jira/projects/route.ts src/app/api/jira/sprints/route.ts src/app/api/jira/statuses/route.ts src/app/api/jira/tasks/route.ts src/app/api/jira/transitions/route.ts src/app/api/jira/update-issue/route.ts src/app/api/jira/users/route.ts src/lib/jira/api.ts`

Expected: test/typecheck PASS; các file mục tiêu không còn error.

- [ ] **Step 5: Commit**

```bash
git add src/lib/jira/apiError.* src/app/api/jira src/lib/jira/api.ts
git commit -m "refactor: type Jira API errors safely"
```

---

### Task 2: Type các Jira payload phức tạp

**Files:**
- Modify: `src/app/api/jira/browse-tasks/route.ts`
- Modify: `src/app/api/jira/hours-by-date/route.ts`
- Modify: `src/app/api/jira/work-tasks/route.ts`

**Interfaces:**
- Giữ nguyên query params, JQL, response `issues/fullIssues/total/startAt/maxResults`.
- Các interface Jira cục bộ chỉ mô tả field thực sự được route đọc.

- [ ] **Step 1: Ghi nhận reproduction trước thay đổi**

Run: `npx eslint src/app/api/jira/browse-tasks/route.ts src/app/api/jira/hours-by-date/route.ts src/app/api/jira/work-tasks/route.ts`

Expected: FAIL đúng 21 `@typescript-eslint/no-explicit-any` errors.

- [ ] **Step 2: Thay `any` bằng kiểu cục bộ tối thiểu**

Định nghĩa và tái sử dụng trong mỗi route các shape tương ứng:

```ts
interface JiraNamedValue { name?: string; value?: string; displayName?: string }
interface JiraPagedResponse<T> { issues?: T[]; total?: number; startAt?: number; maxResults?: number }
interface JiraWorklog { author?: JiraNamedValue; timeSpentSeconds?: number; started?: string }
type JiraUnknownFields = Record<string, unknown>;
```

Với field động/custom field, narrow trước khi đọc:

```ts
const record = typeof value === 'object' && value !== null ? value as Record<string, unknown> : null;
const name = typeof record?.name === 'string' ? record.name : '';
```

Với catch, dùng `unknown` + `getJiraErrorDetails`. Với callbacks `.map/.filter/reduce`, type collection tại nguồn để callback inference tự hoạt động; không thay bằng `unknown as SomeType` chỉ để im lint.

- [ ] **Step 3: Verify task**

Run: `node --test src/app/api/jira/work-tasks/*.test.mjs src/app/api/jira/hours-by-date/*.test.mjs && npx tsc --noEmit && npx eslint src/app/api/jira/browse-tasks/route.ts src/app/api/jira/hours-by-date/route.ts src/app/api/jira/work-tasks/route.ts`

Expected: tests/typecheck/lint PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/jira/browse-tasks/route.ts src/app/api/jira/hours-by-date/route.ts src/app/api/jira/work-tasks/route.ts
git commit -m "refactor: type Jira task payloads"
```

---

### Task 3: Loại synchronous state updates trong React effects

**Files:**
- Modify: `src/app/create-task/page.tsx`
- Modify: `src/app/work-management/page.tsx`
- Modify: `src/components/layout/Sidebar.tsx`
- Modify: `src/components/layout/UserBar.tsx`
- Modify: `src/components/modal/CreateTaskModal.tsx`
- Modify: `src/components/modal/LogWorkModal.tsx`
- Modify: `src/components/profile/ProfileGate.tsx`
- Modify: `src/components/profile/ProfileSetupModal.tsx`
- Modify: `src/lib/i18n.tsx`

**Interfaces:**
- Giữ nguyên component props, fetch endpoints, debounce interval, initial field values, cookie/localStorage keys.
- Event handler sở hữu thay đổi input phải reset dependent state; effects chỉ synchronize external systems hoặc cập nhật trong async callback.

- [ ] **Step 1: Ghi nhận reproduction**

Run: `npx eslint src/app/create-task/page.tsx src/app/work-management/page.tsx src/components/layout/Sidebar.tsx src/components/layout/UserBar.tsx src/components/modal/CreateTaskModal.tsx src/components/modal/LogWorkModal.tsx src/components/profile/ProfileGate.tsx src/components/profile/ProfileSetupModal.tsx src/lib/i18n.tsx`

Expected: FAIL đúng 15 `react-hooks/set-state-in-effect` errors trong nhóm file này.

- [ ] **Step 2: Refactor theo ownership của state**

Áp dụng quyết định cụ thể sau sau khi đọc đầy đủ từng component:

- Cookie/localStorage initial values: lazy initializer có guard `typeof window/document !== 'undefined'`; nếu hydration cần deterministic markup, dùng `useSyncExternalStore` với server snapshot thay vì setState sync trong effect.
- Query rỗng: clear `users/loading/error` ngay trong `onChange` handler; effect return sớm mà không setState.
- Project/issue type/sprint dependent state: reset trong handler chọn parent field, giữ effect chỉ fetch khi dependency hợp lệ.
- Modal open defaults: tạo hàm `createInitialFormState(...)`; gọi trong lazy initializer và handler reset/close thành công, không effect reset.
- Derived values: thay state + effect bằng expression/useMemo khi không có user edit độc lập.

Không dùng `setTimeout(..., 0)` chỉ để né rule và không thêm eslint suppression.

- [ ] **Step 3: Verify task**

Run: `node --test src/lib/profile-cookie.test.mjs src/app/browse-tasks/browseFilterPanel.test.mjs && npx tsc --noEmit && npx eslint src/app/create-task/page.tsx src/app/work-management/page.tsx src/components/layout/Sidebar.tsx src/components/layout/UserBar.tsx src/components/modal/CreateTaskModal.tsx src/components/modal/LogWorkModal.tsx src/components/profile/ProfileGate.tsx src/components/profile/ProfileSetupModal.tsx src/lib/i18n.tsx`

Expected: tests/typecheck/lint PASS và không có error mới.

- [ ] **Step 4: Commit**

```bash
git add src/app/create-task/page.tsx src/app/work-management/page.tsx src/components/layout/Sidebar.tsx src/components/layout/UserBar.tsx src/components/modal/CreateTaskModal.tsx src/components/modal/LogWorkModal.tsx src/components/profile/ProfileGate.tsx src/components/profile/ProfileSetupModal.tsx src/lib/i18n.tsx
git commit -m "refactor: move React state updates out of effects"
```

---

### Task 4: Làm sạch lifecycle của TaskDetailModal và xác minh global

**Files:**
- Modify: `src/components/modal/TaskDetailModal.tsx`
- Modify nếu cần helper testable: `src/components/modal/taskDetailModal.helpers.js`
- Modify nếu cần regression: `src/components/modal/taskDetailModal.helpers.test.mjs`

**Interfaces:**
- Giữ nguyên `TaskDetailModal` props và luồng edit/save/refresh/log work.
- Render không đọc `ref.current`; mutable baseline cần cho save được giữ trong state hoặc reducer.

- [ ] **Step 1: Ghi nhận 6 errors mục tiêu**

Run: `npx eslint src/components/modal/TaskDetailModal.tsx`

Expected: FAIL với 4 `set-state-in-effect`, 1 `refs`, 1 `immutability` errors.

- [ ] **Step 2: Refactor lifecycle theo dữ liệu nguồn**

- Gom state khởi tạo theo issue vào pure helper `createTaskDetailState(issue)` nếu nhiều field phải reset cùng nhau.
- Khi identity issue thay đổi, ưu tiên boundary `key={issue.key}` tại caller hoặc tách inner component keyed để remount state, thay vì effect gọi nhiều setter đồng bộ.
- Thay ref baseline được đọc trong render bằng state `initialValues` được tạo lúc mount/issue change; save handler dùng cùng snapshot.
- Di chuyển helper/function declaration lên trước nơi được closure sử dụng hoặc dùng function declaration ổn định; không mutate binding/compiler dependency.
- Các async effects chỉ setState trong promise resolution và có cleanup guard nếu component unmount/issue đổi.

- [ ] **Step 3: Chạy regression cục bộ**

Run: `node --test src/components/modal/taskDetailModal.helpers.test.mjs && npx tsc --noEmit && npx eslint src/components/modal/TaskDetailModal.tsx src/components/modal/taskDetailModal.helpers.js`

Expected: tests/typecheck/lint PASS.

- [ ] **Step 4: Chạy quality gate toàn repository**

Run: `node --test`

Expected: toàn bộ test PASS.

Run: `npx tsc --noEmit`

Expected: exit code 0.

Run: `npm run lint`

Expected: exit code 0, 0 errors; số warnings không vượt baseline 23.

Run: `npm run build`

Expected: production build thành công.

- [ ] **Step 5: Commit**

```bash
git add src/components/modal/TaskDetailModal.tsx src/components/modal/taskDetailModal.helpers.*
git commit -m "refactor: stabilize task detail modal lifecycle"
```

---

## Execution Continuation

Sau khi Task 4 qua task review và final branch review, tiếp tục ngay `docs/superpowers/plans/2026-07-20-browse-tasks-assignee-combobox.md` bằng cùng workflow subagent-driven; không cần checkpoint người dùng giữa hai plan.
