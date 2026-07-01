# Personal Statistics — Month/Year Filter & JQL Migration

**Date:** 2026-07-01  
**Scope:** `src/app/statistics/personal/page.tsx`, `src/app/api/jira/search/route.ts`, `src/lib/i18n.tsx`

---

## Context

Màn Personal Statistics hiện lấy dữ liệu bằng cách gọi Jira saved filter cố định (ID `10244`) qua `/api/jira/search`. Yêu cầu mới:

1. Chuyển sang JQL tự build với tham số động (assignee, tháng, năm)
2. Bổ sung bộ lọc tháng/năm trên UI

---

## Goals

- Dữ liệu cá nhân chính xác hơn: lọc theo `assignee = email`, `originalEstimate`, `labels`, và khoảng thời gian của tháng được chọn
- User có thể xem thống kê của các tháng khác nhau (không chỉ tháng hiện tại)
- Giữ nguyên convention UX/UI/theme (`glass-select`, animation, i18n, error states)

---

## JQL Template

```
assignee = "${assigneeEmail}"
AND (
  (labels NOT IN (hashsubtask) OR labels IS EMPTY)
  AND originalEstimate IS NOT EMPTY
)
AND (
  (
    "Start Date (Time)" >= "${startOfMonth}"
    AND "Due Date (Time)" <= "${endOfMonth}"
  )
  OR (
    "Start Date (Time)" IS EMPTY
    OR "Due Date (Time)" IS EMPTY
  )
)
ORDER BY updated DESC
```

**Date format:** `"yyyy-MM-dd HH:mm"` — cụ thể:
- `startOfMonth` = `"${year}-${mm}-01 00:00"`
- `endOfMonth`   = `"${year}-${mm}-${lastDay} 23:59"` (`lastDay` tính bằng `new Date(year, month, 0).getDate()`)

---

## Architecture

### Approach: Extend `/api/jira/search` (Approach A)

Thêm nhánh `personalMode` vào route handler hiện có. Không tạo route mới.

**Request body mới:**
```json
{
  "personalMode": true,
  "assigneeEmail": "user@example.com",
  "year": 2026,
  "month": 7,
  "groupBy": "status",
  "statusGrouping": "personal",
  "startAt": 0,
  "maxResults": 100
}
```

**Server logic:**
1. Nếu `personalMode === true` → build JQL từ `assigneeEmail`, `year`, `month`
2. Tính `startOfMonth`, `endOfMonth` server-side
3. Mọi bước tiếp theo (groupBy, aggregation, fullIssues) giữ nguyên

**Response shape:** không đổi — `{ issues, fullIssues, aggregated, total }`

---

## Frontend Changes

### State mới

```ts
const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth() + 1);
const [selectedYear, setSelectedYear]   = useState(() => new Date().getFullYear());
```

Email đọc từ `readProfileFromDocumentCookie()` (import từ `@/lib/profile-cookie.js`), không lưu vào state.

### `fetchData` cập nhật

Nhận `(month: number, year: number)` thay vì không nhận tham số. Nếu không có email cookie → set error với key `personal.noEmailError`, không gọi API.

### `fetchWorkingDays` cập nhật

Truyền `month` và `year` vào query params thay vì dùng `new Date()` cứng.

### `useEffect` trigger

```ts
useEffect(() => {
  void fetchWorkingDays(selectedMonth, selectedYear);
  void fetchData(selectedMonth, selectedYear);
}, [selectedMonth, selectedYear]);
```

### UI — Month/Year Picker

**Vị trí:** ngay sau `{t('personal.savedFilterInfo')}`, cùng block `animate-slide-up`.

**Markup:**

```tsx
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
```

**Behavior:** đổi month/year → auto-fetch, không cần nút Refresh riêng.

---

## i18n Keys (thêm mới / cập nhật)

| Key | VI | EN |
|---|---|---|
| `personal.monthLabel` | `Tháng` | `Month` |
| `personal.yearLabel` | `Năm` | `Year` |
| `personal.noEmailError` | `Không tìm thấy thông tin người dùng. Vui lòng đăng nhập lại.` | `User profile not found. Please log in again.` |
| `personal.workingDays` | `Số ngày làm việc tháng {month}/{year}: {days}` | `Working days {month}/{year}: {days}` |

`personal.workingDays` được cập nhật để thêm param `{month}` và `{year}` (hiện chỉ có `{days}`).

---

## Error Handling

| Tình huống | Xử lý |
|---|---|
| Không có email cookie | Hiện error banner `personal.noEmailError`, không gọi API |
| API lỗi | Giữ nguyên error state hiện có |
| Calendar API lỗi | Giữ nguyên fallback hiện có |

---

## Files Affected

| File | Thay đổi |
|---|---|
| `src/app/statistics/personal/page.tsx` | State month/year, picker UI, refactor fetchData/fetchWorkingDays |
| `src/app/api/jira/search/route.ts` | Thêm nhánh `personalMode` build JQL |
| `src/lib/i18n.tsx` | Thêm 3 keys mới, cập nhật `personal.workingDays` |

---

## Out of Scope

- Không thay đổi component `JiraBarChart`, `JiraTable`, `TaskDetailModal`, `LogWorkModal`
- Không thay đổi calendar API route
- Không thay đổi các trang thống kê khác
