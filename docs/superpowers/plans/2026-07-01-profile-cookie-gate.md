# Profile Cookie Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm profile gate dùng cookie để chặn toàn app cho tới khi người dùng chọn tên/email từ danh sách Jira users.

**Architecture:** Tách logic cookie vào helper riêng, đặt một `ProfileGate` client component ở mức layout để đọc cookie và mở `ProfileSetupModal` khi thiếu profile. Modal dùng dropdown searchable và tái sử dụng API `/api/jira/users` với debounce client-side.

**Tech Stack:** Next.js App Router, React client components, native cookie API trong browser, Node test runner.

---

### Task 1: Cookie Helper

**Files:**
- Create: `src/lib/profile-cookie.js`
- Test: `src/lib/profile-cookie.test.mjs`

- [ ] Viết test fail cho parse/normalize cookie profile và thời hạn 2 năm
- [ ] Chạy test để xác nhận fail vì helper chưa tồn tại hoặc chưa đúng
- [ ] Viết helper đọc/ghi/xóa cookie profile tối thiểu
- [ ] Chạy test để xác nhận pass

### Task 2: Profile Gate UI

**Files:**
- Create: `src/components/profile/ProfileSetupModal.tsx`
- Create: `src/components/profile/ProfileGate.tsx`
- Modify: `src/app/globals.css`

- [ ] Thêm modal bắt buộc nhập user với input searchable, dropdown, loading, empty, error
- [ ] Thêm gate đọc cookie lúc mount và chặn toàn app nếu thiếu `jira_display_name`
- [ ] Bổ sung style tối thiểu nếu cần cho overlay/modal

### Task 3: App Integration

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] Bọc toàn app bằng `ProfileGate`
- [ ] Đảm bảo khi có cookie thì app render bình thường, khi chưa có thì modal phủ toàn bộ

### Task 4: Verification

**Files:**
- Test: `src/lib/profile-cookie.test.mjs`

- [ ] Chạy test helper cookie
- [ ] Chạy lint hoặc kiểm tra cục bộ phù hợp và ghi nhận mọi lỗi nền sẵn có nếu có
