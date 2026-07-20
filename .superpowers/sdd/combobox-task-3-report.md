# Báo cáo Task 3 — AssigneeCombobox accessible

## Trạng thái

- Hoàn thành component `AssigneeCombobox` và bản dịch Việt/Anh.
- Giữ nguyên baseline `useSyncExternalStore` trong `src/lib/i18n.tsx`; chỉ thêm khóa dịch.
- Không dùng set-state trong effect. Effect duy nhất chỉ cleanup blur timer khi remount/unmount.

## Thay đổi

- Thêm combobox theo ARIA pattern: `combobox`, `listbox`, `option`, accessible name, `aria-expanded`, `aria-controls`, `aria-activedescendant` và `aria-selected`.
- Mở khi focus, lọc theo helper khi nhập, reset highlight về đầu danh sách và hỗ trợ Arrow Up/Down, Enter, Escape.
- Blur chỉ nhận username/email khớp chính xác; input rỗng hoặc không hợp lệ trả về `All` qua `onChange('')`.
- Option dùng `onMouseDown(event.preventDefault())` để không bị blur chọn sai trước click.
- Blur timer được hủy khi chọn option hoặc khi component remount/unmount, tránh callback cũ ghi ngược external reset.
- Đồng bộ external `value`, reset và display name bằng `key={syncKey}`, không cần effect set-state.
- Hiển thị riêng loading, error và empty state với `role="status"`/`role="alert"`.
- Thêm bốn khóa dịch `assigneePlaceholder`, `assigneeLoading`, `assigneeEmpty`, `assigneeError` cho cả `vi` và `en`.

## Deviation Windows-safe

Windows dùng filesystem không phân biệt hoa/thường, nên hai cặp tên trong brief bị collision:

- `AssigneeCombobox.test.mjs` và `assigneeCombobox.test.mjs`.
- `AssigneeCombobox.tsx` và import helper `assigneeCombobox.js` (TypeScript resolve nhầm sang TSX, lỗi TS1149).

Theo binding của orchestrator:

- Test component dùng tên `AssigneeCombobox.component.test.mjs`.
- Helper/test Task 2 được rename nguyên vẹn thành `assigneeComboboxHelpers.js` và `assigneeComboboxHelpers.test.mjs`; component và test helper cập nhật import tương ứng.

## TDD

1. RED: `node --test src/components/form/AssigneeCombobox.test.mjs` thất bại đúng kỳ vọng với `ENOENT` trước khi component tồn tại.
2. GREEN: test cấu trúc accessible và helper pass sau khi triển khai; test component sau đó được đổi sang tên Windows-safe.
3. Self-review phát hiện blur timer có thể chạy sau external reset.
4. RED: regression test yêu cầu `clearTimeout` thất bại đúng tại assertion `/clearTimeout/`.
5. GREEN: thêm timer ref và cleanup; component/helper đạt 5/5 test.

## Gates

- `node --test src/components/form/AssigneeCombobox.component.test.mjs src/components/form/assigneeComboboxHelpers.test.mjs`: PASS 5/5.
- `npx tsc --noEmit`: PASS.
- Target lint component/i18n/helper/test: PASS, không warning/error.
- `node --test`: PASS 79/79.
- `npm run lint`: PASS, 0 error; còn 18 warning baseline ngoài phạm vi.
- `git diff --check`: PASS; PowerShell/Git chỉ thông báo chuyển LF sang CRLF ở working copy.

## Self-review

- Không ghi đè thay đổi ngoài scope và không revert baseline i18n.
- Helper behavior/test Task 2 giữ nguyên; chỉ rename để TypeScript compile được trên Windows.
- Không còn active descendant trỏ tới option không tồn tại trong loading/error state.
- Pending blur callback không thể ghi ngược lựa chọn option hoặc external reset sau remount.
