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

## Phụ lục review follow-up

Phụ lục này thay thế các chi tiết implementation ban đầu về `key={syncKey}`, chọn option trong `onMouseDown` và status nằm trong listbox.

### Sửa đổi

- Bỏ hoàn toàn `syncKey`/remount. State input lưu `{ query, valueAtLastInteraction }`; `visibleQuery` dùng query nội bộ khi baseline trùng prop, nếu không sẽ lấy display name từ external `value`. Input giữ focus khi parent đổi/reset giá trị.
- `choose` ghi query và baseline của giá trị được chọn trước khi gọi `onChange`; mọi tương tác input nhận prop `value` hiện tại làm baseline.
- Cleanup blur timer khi unmount hoặc external `value` đổi, đồng thời `choose` vẫn hủy timer đang chờ.
- `onMouseDown` chỉ `preventDefault()` với nút chuột chính để giữ focus; `onClick` mới chọn option, hỗ trợ activation từ AT/bàn phím và không chọn bằng nút phụ.
- Loading/error/empty dùng live region riêng ngoài listbox. Loading được ưu tiên nếu loading và error cùng true.
- Chỉ render listbox khi thực sự có option; `aria-expanded`, `aria-controls` và `aria-activedescendant` chỉ trỏ tới popup/option đang tồn tại.

### TDD follow-up

1. RED external sync: test `doesNotMatch /key={syncKey}/` thất bại trên implementation remount cũ; GREEN sau state-derived sync.
2. RED option activation: test yêu cầu primary-button guard và `onClick` thất bại vì `choose` còn nằm trong `onMouseDown`; GREEN sau khi tách hai event.
3. RED popup semantics: test yêu cầu `hasOptions`, live regions ngoài listbox và conditional `aria-controls` thất bại; GREEN sau khi tách status/listbox.
4. RED status precedence: test yêu cầu error chỉ render khi `!loading` thất bại; GREEN sau khi giữ lại thứ tự ưu tiên ban đầu.
5. RED blur/reset race: test yêu cầu cleanup phụ thuộc `[value]` thất bại trên cleanup chỉ-unmount; GREEN sau khi cleanup chạy cả khi controlled value đổi.

### Gates follow-up

- Component + helper tests: PASS 7/7.
- `npx tsc --noEmit`: PASS.
- Target lint component/test/helper: PASS, không warning/error.
- `node --test`: PASS 81/81.
- `npm run lint`: PASS, 0 error; còn 18 warning baseline ngoài phạm vi.
- `git diff --check`: PASS; chỉ có thông báo chuyển LF sang CRLF ở working copy.
