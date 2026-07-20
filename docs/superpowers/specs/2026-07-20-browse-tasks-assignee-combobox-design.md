# Thiết kế combobox Assignee cho Browse Tasks

## Bối cảnh

Route thực tế của màn hình là `/browse-tasks`. Bộ lọc Assignee hiện dùng thẻ `select`. Trang đã gọi `/api/jira/users` khi mount, nhưng endpoint chỉ yêu cầu tối đa 20 người dùng nên không cung cấp đủ danh sách dài để tìm kiếm tại client.

## Mục tiêu

Thay bộ lọc Assignee bằng combobox cho phép nhập để lọc nhanh trên toàn bộ danh sách người dùng đã được tải ngầm một lần khi trang vừa mount. Sau khi tải xong, việc nhập và lọc không phát sinh thêm request tìm người dùng.

Không thay đổi các bộ lọc khác, cách áp dụng bộ lọc hoặc endpoint `/api/jira/browse-tasks`.

## Phương án được chọn

Sử dụng custom combobox và mở rộng `/api/jira/users` để server gom toàn bộ người dùng từ Jira theo phân trang.

Không dùng HTML `datalist` vì khó kiểm soát trạng thái đã chọn, fallback và hành vi bàn phím nhất quán. Không thêm thư viện select mới vì phạm vi chỉ có một trường và dự án hiện chưa có dependency phù hợp.

## Luồng dữ liệu

1. Khi `/browse-tasks` mount, trang đồng thời tải task và gọi `/api/jira/users` ở chế độ lấy toàn bộ người dùng.
2. API users gọi Jira theo từng trang cho đến khi hết dữ liệu, chuẩn hóa kết quả và loại trùng theo `email || name`.
3. Client lưu toàn bộ danh sách trong state của trang và truyền xuống `FilterPanel`.
4. Mỗi lần người dùng nhập, combobox chỉ lọc mảng trong bộ nhớ theo `displayName`, `name` và `email`; không gọi API.
5. Khi chọn một người, filter lưu định danh `email || name`. Khi bấm **Áp dụng**, định danh này tiếp tục được gửi qua tham số `assignee` như luồng hiện tại.
6. Khi Assignee là `All`, request tải task không có tham số `assignee`.

Việc tải users độc lập với việc tải task. Lỗi users không làm thất bại màn hình hoặc request danh sách task.

## Hành vi combobox

- Trạng thái mặc định là `All` và không có assignee được chọn.
- Khi focus, dropdown mở và hiển thị danh sách đã tải ngầm.
- Khi nhập, danh sách lọc theo tên hiển thị, username và email.
- Chuỗi tìm kiếm được trim và so khớp không phân biệt hoa thường.
- Chọn bằng chuột hoặc bàn phím lưu user hợp lệ; input hiển thị `displayName`.
- Xóa toàn bộ nội dung tương đương chọn `All`.
- Khi input mất focus mà người dùng chưa chọn một kết quả:
  - Nếu nội dung khớp chính xác username hoặc email của một user, chọn user đó.
  - Nếu chỉ khớp một phần hoặc không khớp chính xác, reset ngay về `All`.
- Trong lúc input còn focus, nội dung khớp một phần được giữ nguyên để người dùng tiếp tục gõ và xem kết quả lọc.
- Nút **Áp dụng** chỉ gửi assignee đã được xác thực. Draft không hợp lệ không được truyền sang Jira.
- Dropdown hỗ trợ phím mũi tên để đổi mục đang highlight, Enter để chọn và Escape để đóng.

## Trạng thái giao diện

- Khi danh sách đang tải, dropdown hiển thị trạng thái tải.
- Khi từ khóa không có kết quả, dropdown hiển thị trạng thái không tìm thấy.
- Khi tải users lỗi, dropdown hiển thị trạng thái lỗi và Assignee giữ `All`; các bộ lọc khác vẫn dùng được.
- Giao diện tiếp tục dùng màu, border và hiệu ứng glass hiện có của filter panel.
- Combobox cần các thuộc tính ARIA phù hợp cho input, listbox và option.

## Ranh giới component

- Tách combobox Assignee thành component có trách nhiệm quản lý query hiển thị, trạng thái mở, mục highlight và việc chuẩn hóa khi blur.
- `FilterPanel` tiếp tục sở hữu draft `BrowseFilters`; combobox chỉ trả về giá trị assignee hợp lệ hoặc chuỗi rỗng cho `All`.
- `BrowseTasksPage` tiếp tục sở hữu danh sách users được tải một lần và truyền xuống panel.
- Logic lấy tất cả các trang, chuẩn hóa và loại trùng người dùng nằm ở route users hoặc helper độc lập để có thể kiểm thử mà không phụ thuộc UI.

## Xử lý lỗi và giới hạn

- API users trả lỗi rõ ràng nếu một trang Jira thất bại; không trả danh sách đầy đủ giả tạo từ dữ liệu dở dang.
- Client bắt lỗi riêng cho users và không đưa lỗi này vào trạng thái lỗi tải task.
- Request users chỉ chạy khi trang mount, không chạy lại theo query hoặc mỗi lần mở dropdown.
- Cần có điều kiện dừng phân trang rõ ràng dựa trên số phần tử của trang trả về để tránh vòng lặp vô hạn.

## Kiểm thử và tiêu chí hoàn thành

- API users gom đủ nhiều trang, dừng đúng khi hết dữ liệu và loại user trùng.
- `/browse-tasks` chỉ tải toàn bộ users một lần khi mount.
- Nhập từ khóa chỉ lọc client-side và không phát sinh request tìm user.
- Lọc không phân biệt hoa thường theo `displayName`, `name` và `email`.
- Chọn user lưu đúng `email || name` và input hiển thị đúng `displayName`.
- Nhập chính xác username hoặc email rồi blur chọn đúng user.
- Nhập một phần nhưng không chọn rồi blur reset về `All`.
- Xóa input reset về `All`.
- Phím mũi tên, Enter và Escape hoạt động đúng.
- Trạng thái loading, không có kết quả và lỗi users hiển thị đúng.
- Khi API users lỗi, danh sách task và các bộ lọc khác vẫn hoạt động.
- Các hành vi hiện có của panel, badge bộ lọc, **Đặt lại**, **Áp dụng** và `/api/jira/browse-tasks` không bị thay đổi.

## Ngoài phạm vi

- Không hỗ trợ chọn nhiều assignee.
- Không gọi Jira tìm kiếm theo từng ký tự.
- Không cache danh sách users qua lần reload trang hoặc giữa nhiều tab.
- Không thay đổi JQL phía `/api/jira/browse-tasks`.
- Không refactor các phần khác của Browse Tasks.
