# User Bar + Logout — Design

Date: 2026-07-01

## Mục tiêu

Bổ sung một thanh thông tin người dùng (user bar) trong sidebar, đặt giữa header (title
"Jira Dashboard") và danh sách menu options. Bar hiển thị tên + email + avatar của người
dùng hiện tại. Bấm vào bar mở một dropdown chứa option Logout. Khi Logout: hiện màn loading
full-screen ("Logging out" / "See you again..."), xóa cookie profile, rồi reload trang.

## Bối cảnh hiện tại

- Sidebar: `src/components/layout/Sidebar.tsx` — header (title + nút theme/lang/collapse) rồi `<nav>`.
- Cookie profile: `src/lib/profile-cookie.js` — hiện lưu `jira_display_name`, `jira_email`.
- Profile gate: `src/components/profile/ProfileGate.tsx` — đọc cookie, quản state profile, mở modal setup nếu chưa có.
- Profile setup: `src/components/profile/ProfileSetupModal.tsx` — chọn user qua `/api/jira/users`.
- Users API: `src/app/api/jira/users/route.ts` — gọi Jira `/rest/api/2/user/search`, hiện KHÔNG map `avatarUrls`.

## Quyết định thiết kế

- Avatar lấy từ Jira tại thời điểm chọn user (không dùng chỉ initials). Lưu URL 48x48 vào cookie.
- Fallback initials khi cookie chưa có avatar (vd user đã set profile trước feature này) hoặc ảnh lỗi.
- Collapsed sidebar: user bar chỉ hiện avatar tròn, vẫn bấm được.
- Dropdown logout: popup nhỏ ngay dưới bar, click ra ngoài thì đóng.
- Logout overlay: full-screen, delay ~1200ms rồi reload.
- Logout chỉ xóa cookie profile; giữ nguyên theme/language trong localStorage.
- Tách component riêng (`UserBar`, `LogoutOverlay`) thay vì nhồi vào `Sidebar.tsx` (đã ~420 dòng).

## Thành phần

### 1. Cookie layer — `src/lib/profile-cookie.js`

- Thêm `PROFILE_COOKIE_NAMES.avatarUrl = 'jira_avatar_url'`.
- `parseProfileCookieString`: trả thêm `avatarUrl` (decode; rỗng nếu không có).
- `buildProfileCookieAssignments`: ghi thêm dòng cookie avatar (encode, cùng attributes Max-Age/Path/SameSite).
- `clearProfileDocumentCookie`: xóa thêm cookie avatar (Max-Age=0).
- `ProfileState` (trong ProfileGate) thêm `avatarUrl?: string`.

### 2. Users API — `src/app/api/jira/users/route.ts`

- Map thêm `avatarUrl: u.avatarUrls?.['48x48'] || ''` vào mỗi user trả về.
- `ProfileSetupModal.handleConfirm`: truyền thêm `avatarUrl` vào `onSelectProfile`.
- `ProfileGate.handleSelectProfile`: nhận `avatarUrl`, ghi vào cookie qua `writeProfileToDocumentCookie`.

### 3. UserBar — `src/components/layout/UserBar.tsx` (client)

- Đặt trong `Sidebar` giữa header và `<nav>`; nhận prop `collapsed: boolean`.
- Đọc profile từ cookie (`readProfileFromDocumentCookie`) trong `useEffect`; không render gì nếu chưa có profile.
- Mở rộng: avatar tròn 32px + displayName (truncate 1 dòng) + email (nhỏ, dim, truncate). Toàn bộ là `<button>`.
- Collapsed: chỉ avatar tròn canh giữa, vẫn bấm được.
- Avatar: `<img src={avatarUrl}>` nếu có; `onError` hoặc rỗng → initials (chữ cái đầu displayName) trên nền `var(--accent-bg)`.
- Bấm → toggle dropdown popup ngay dưới bar (`position: absolute`), chứa 1 item Logout (icon + label i18n).
- Đóng dropdown khi click ra ngoài (listener `mousedown` trên document, cleanup khi unmount).
- Bấm Logout → gọi callback từ Sidebar để bật LogoutOverlay.

### 4. LogoutOverlay — `src/components/layout/LogoutOverlay.tsx`

- Full-screen `fixed inset-0 z-[2000]`, nền blur (giống overlay modal hiện có).
- Nội dung: spinner + "Logging out" (đậm) + "See you again..." (dim), canh giữa.
- Flow: khi mount → `clearProfileDocumentCookie()` → `setTimeout(~1200ms)` → `window.location.reload()`.
- Chỉ xóa cookie profile, không đụng localStorage.

### 5. i18n & Test

- Keys mới (vi + en) trong `src/lib/i18n`: `nav.logout` ("Đăng xuất"/"Logout"),
  `logout.title` ("Logging out"), `logout.subtitle` ("See you again...").
- Test thuần (`.test.mjs`, theo pattern repo):
  - cookie roundtrip có avatar (build → parse trả đúng avatarUrl).
  - clear xóa cả 3 cookie.
  - initials helper: lấy chữ cái đầu từ displayName; rỗng → fallback an toàn.

## Testing reality

- UserBar & LogoutOverlay là UI → verify thủ công (hiển thị, collapsed, dropdown, logout flow).
- Logic thuần (cookie, initials) → có unit test.

## Ngoài phạm vi (YAGNI)

- Không tạo global auth context — cookie profile vẫn là nguồn sự thật duy nhất.
- Không xử lý refresh avatar định kỳ; avatar lưu lúc chọn user là đủ.
- Không xóa theme/language khi logout.
