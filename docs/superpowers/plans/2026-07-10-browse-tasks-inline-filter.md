# Browse Tasks Inline Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay modal bộ lọc của `/browse-tasks` bằng panel full-width expand/collapse nằm trên danh sách và giữ nguyên draft khi thu gọn.

**Architecture:** Giữ toàn bộ UI và state trong `src/app/browse-tasks/page.tsx` theo cấu trúc hiện tại. `FilterPanel` luôn được mount; component cha chỉ điều khiển trạng thái hiển thị, còn draft tiếp tục thuộc panel nên không bị mất qua collapse.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS, Node.js built-in test runner.

## Global Constraints

- Giữ nguyên bố cục các nhóm bộ lọc đang có trong working tree.
- Panel mặc định thu gọn và nằm ngay trên phần lỗi/danh sách.
- Thu gọn không làm mất draft; Áp dụng không tự thu gọn panel.
- Không đổi API, JQL, trường lọc, phân trang hoặc các luồng task detail/log work.
- Không thêm dependency.

---

### Task 1: Chuyển modal bộ lọc thành panel inline

**Files:**
- Create: `src/app/browse-tasks/browseFilterPanel.test.mjs`
- Modify: `src/app/browse-tasks/page.tsx`

**Interfaces:**
- Consumes: `BrowseFilters`, `EMPTY_FILTERS`, các danh sách `Project[]`, `IssueType[]`, `Status[]`, `JiraUser[]` và callback `(filters: BrowseFilters) => void` hiện có.
- Produces: `FilterPanel` luôn mount, nhận prop `expanded: boolean`; nút điều khiển có `aria-expanded` và `aria-controls="browse-tasks-filter-panel"`.

- [ ] **Step 1: Viết kiểm thử hồi quy thất bại**

Tạo `src/app/browse-tasks/browseFilterPanel.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.join(process.cwd(), 'src/app/browse-tasks/page.tsx'), 'utf8');

test('browse task filter is an inline expandable panel', () => {
  assert.match(source, /function FilterPanel\(/);
  assert.match(source, /id="browse-tasks-filter-panel"/);
  assert.match(source, /aria-expanded=\{showFilterPanel\}/);
  assert.match(source, /aria-controls="browse-tasks-filter-panel"/);
  assert.doesNotMatch(source, /fixed inset-0 z-\[300\]/);
});

test('filter panel remains mounted and applying filters keeps it expanded', () => {
  assert.match(source, /<FilterPanel[\s\S]*expanded=\{showFilterPanel\}/);
  assert.doesNotMatch(source, /\{showFilterPanel && \(\s*<FilterPanel/);
  assert.doesNotMatch(source, /handleSubmitFilters[\s\S]{0,220}setShowFilterPanel\(false\)/);
});
```

- [ ] **Step 2: Chạy test để xác nhận RED**

Run: `node --test src/app/browse-tasks/browseFilterPanel.test.mjs`

Expected: FAIL vì `FilterPanel`, `showFilterPanel`, ARIA và panel inline chưa tồn tại.

- [ ] **Step 3: Viết implementation tối thiểu**

Trong `src/app/browse-tasks/page.tsx`:

- Đổi `FilterModalProps`/`FilterModal` thành `FilterPanelProps`/`FilterPanel`.
- Bỏ `onClose`, effect bắt Escape, overlay, backdrop, header modal và nút `X`.
- Thêm prop `expanded`; đặt wrapper panel có `id="browse-tasks-filter-panel"`, `aria-hidden={!expanded}`, full width, và class/style chuyển đổi `maxHeight`, `opacity`, `margin`, `border` để expand/collapse.
- Giữ component luôn mount; vô hiệu pointer events và overflow khi collapse.
- Đổi state `showFilterModal` thành `showFilterPanel`, mặc định `false`.
- Nút **Bộ lọc** thêm `aria-expanded={showFilterPanel}`, `aria-controls="browse-tasks-filter-panel"` và chevron xoay theo trạng thái.
- Render `<FilterPanel expanded={showFilterPanel} ... />` ngay sau hàng tiêu đề, trước error và danh sách, không bọc bằng điều kiện.
- Xóa `setShowFilterPanel(false)` khỏi `handleSubmitFilters` để Áp dụng giữ panel mở.

- [ ] **Step 4: Chạy test để xác nhận GREEN**

Run: `node --test src/app/browse-tasks/browseFilterPanel.test.mjs`

Expected: 2 tests PASS.

- [ ] **Step 5: Chạy kiểm tra toàn dự án**

Run: `node --test "src/**/*.test.mjs"`

Expected: toàn bộ tests PASS.

Run: `npm run lint -- src/app/browse-tasks/page.tsx src/app/browse-tasks/browseFilterPanel.test.mjs`

Expected: exit code 0, không có ESLint error.

Run: `npm run build`

Expected: Next.js production build thành công.

- [ ] **Step 6: Commit riêng thay đổi tính năng**

```bash
git add src/app/browse-tasks/page.tsx src/app/browse-tasks/browseFilterPanel.test.mjs
git commit -m "feat: expand browse task filters inline"
```

Không stage `src/app/api/jira/avatar/route.ts` hoặc thay đổi không liên quan.
