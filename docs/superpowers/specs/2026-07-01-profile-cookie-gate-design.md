# Profile Cookie Gate Design

## Mục tiêu

Áp dụng cookie cho web để lưu thông tin người dùng gồm tên hiển thị và email với thời hạn 2 năm. Nếu chưa có tên người dùng trong cookie, hệ thống sẽ chặn toàn app bằng một modal bắt buộc chọn người dùng trước khi tiếp tục.

## Phạm vi

- Lưu `jira_display_name` và `jira_email` bằng cookie client-side.
- Thêm một gate ở mức app để kiểm tra cookie trước khi cho sử dụng giao diện chính.
- Thêm modal chọn người dùng với dropdown searchable.
- Dropdown fetch dữ liệu từ API người dùng hiện có, cùng pattern với assignee.

## Ngoài phạm vi

- Không thêm middleware hay redirect server-side.
- Không thêm chức năng đổi profile từ menu người dùng trong phase này.
- Không thay đổi logic phân quyền hay session authentication Jira.

## Kiến trúc

### 1. Cookie helper

Tạo `src/lib/profile-cookie.ts` để:

- định nghĩa key cookie:
  - `jira_display_name`
  - `jira_email`
- đọc cookie profile
- ghi cookie profile với hạn 2 năm
- xóa cookie profile nếu cần

### 2. ProfileGate

Tạo `src/components/profile/ProfileGate.tsx` là client component:

- đọc cookie khi mount
- giữ state `isReady` và `profile`
- nếu thiếu `jira_display_name`, hiển thị overlay chặn toàn app
- nếu đủ dữ liệu, render children bình thường

Gate sẽ được cắm ở mức wrapper/layout client để áp dụng cho toàn bộ web.

### 3. ProfileSetupModal

Tạo `src/components/profile/ProfileSetupModal.tsx`:

- modal bắt buộc, không cho đóng khi chưa chọn user
- có input searchable
- debounce khoảng 300ms
- gọi `/api/jira/users?query=...`
- hiện dropdown kết quả kiểu autocomplete
- chỉ cho xác nhận khi người dùng đã chọn một item từ danh sách

Thông tin hiển thị mỗi option:

- `displayName`
- `name` hoặc email dùng làm secondary text

### 4. App integration

Tích hợp `ProfileGate` vào wrapper/layout client hiện có để:

- chặn toàn app nếu chưa có cookie
- không phải lặp logic ở từng page

## Data flow

1. App mount
2. `ProfileGate` đọc cookie
3. Nếu có đủ `jira_display_name` và `jira_email`, render app
4. Nếu thiếu `jira_display_name`, mở `ProfileSetupModal`
5. User gõ từ khóa
6. Modal debounce rồi fetch `/api/jira/users?query=...`
7. User chọn một option
8. Modal lưu cookie 2 năm
9. `ProfileGate` cập nhật state và đóng modal
10. App được mở khóa

## Error handling

- Nếu API lỗi, modal hiển thị lỗi ngắn và cho phép thử lại
- Nếu không có kết quả, modal hiển thị trạng thái rỗng
- Nếu người dùng chỉ gõ text mà chưa chọn option, không cho xác nhận
- Nếu cookie hỏng hoặc thiếu một phần, xem như chưa cấu hình profile

## UI/UX

- Modal dùng visual language hiện có của app
- Dropdown hỗ trợ filter theo khi gõ
- Overlay chặn thao tác vào phần app bên dưới
- Hỗ trợ dark mode theo hệ style hiện tại

## Testing

- test helper cookie read/write normalization nếu phù hợp
- test gate logic với trường hợp có cookie và không có cookie
- test modal state cơ bản:
  - loading
  - no result
  - select user

## Quyết định chính

- Dùng cookie client-side thay vì middleware server-side
- Chặn toàn app thay vì chỉ nhắc nhẹ
- Chỉ cho chọn user từ danh sách fetch ra, không nhập tự do
- Tái sử dụng API `/api/jira/users`
