# Thiết kế bộ lọc inline cho Browse Tasks

## Bối cảnh

Màn thực tế là `/browse-tasks`. Hiện nút **Bộ lọc** mở một modal phủ lên nội dung. Bộ lọc trong working tree đã được bố trí thành các hàng full-size và thay đổi này phải được giữ nguyên.

## Mục tiêu

Thay modal bằng một vùng bộ lọc full-width có thể expand/collapse, nằm ngay dưới hàng tiêu đề và ngay trên phần lỗi/danh sách. Không thay đổi các trường, thứ tự nhóm, cách đếm bộ lọc đang áp dụng hoặc API tìm kiếm.

## Hành vi giao diện

- Khi mới vào màn hình, vùng bộ lọc ở trạng thái thu gọn.
- Nút **Bộ lọc** hiện tại điều khiển expand/collapse, giữ badge đếm bộ lọc đang áp dụng và bổ sung chevron thể hiện trạng thái.
- Nút có `aria-expanded` và liên kết đến panel bằng `aria-controls`.
- Panel full-width nằm trong luồng trang, đẩy danh sách xuống khi mở; không dùng overlay, backdrop hoặc modal.
- Bỏ nút đóng `X` và hành vi đóng bằng phím Escape. Người dùng đóng/mở panel bằng nút **Bộ lọc**.
- Panel luôn được mount; collapse chỉ ẩn phần hiển thị. Vì vậy mọi giá trị người dùng đang sửa nhưng chưa áp dụng vẫn được giữ khi đóng rồi mở lại.
- Bấm **Áp dụng** cập nhật bộ lọc đã áp dụng và tải lại danh sách, nhưng panel vẫn mở.
- Bấm **Đặt lại** chỉ đưa draft trong panel về bộ lọc rỗng như hành vi hiện tại; người dùng vẫn cần bấm **Áp dụng** để tải lại danh sách.

## Bố cục bộ lọc

Giữ nguyên bố cục hiện có trong working tree:

1. Ô tìm kiếm toàn chiều ngang.
2. Hai trường ngày bắt đầu/tới ngày trên cùng một hàng khi đủ chỗ.
3. Project, loại công việc và người thực hiện trên cùng một hàng khi đủ chỗ.
4. Danh sách trạng thái dạng các lựa chọn wrap.
5. Hàng hành động **Đặt lại** và **Áp dụng** ở cuối panel.

Trên màn hình hẹp, các nhóm tiếp tục wrap theo quy tắc flex hiện có. Panel dùng màu, border, bo góc và hiệu ứng glass hiện tại để đồng bộ với màn hình.

## Cấu trúc component và state

- Đổi `FilterModal` thành `FilterPanel` và bỏ các prop/hành vi chỉ dành cho modal như `onClose`.
- `FilterPanel` tiếp tục sở hữu draft `filters`, được khởi tạo từ bộ lọc đã áp dụng.
- Component trang tiếp tục sở hữu `filters` đã áp dụng và state boolean hiển thị panel (đổi tên từ `showFilterModal` sang tên phản ánh panel).
- Panel được render thường trực để draft không bị mất khi collapse.
- `handleSubmitFilters` không thu gọn panel sau khi áp dụng.
- Luồng gọi `/api/jira/browse-tasks` và cách tính `activeFilterCount` giữ nguyên.

## Trạng thái lỗi và tải dữ liệu

- Lỗi tải danh sách vẫn hiển thị dưới panel và trên bảng.
- Trạng thái loading của bảng giữ nguyên.
- Việc tải project, loại công việc, trạng thái và người dùng không thay đổi; trạng thái chưa tải của danh sách status vẫn dùng thông báo hiện tại.

## Kiểm thử và tiêu chí hoàn thành

- Panel mặc định thu gọn khi vào màn.
- Bấm nút **Bộ lọc** mở/đóng đúng panel và cập nhật `aria-expanded`.
- Panel nằm full-width phía trên danh sách, không còn overlay/modal.
- Draft được giữ nguyên sau chuỗi mở → sửa → đóng → mở.
- **Đặt lại** xóa draft nhưng chưa tự gọi API.
- **Áp dụng** gọi lại danh sách bằng draft, cập nhật badge và giữ panel mở.
- Bố cục trường và khả năng wrap trên màn hình hẹp không bị thay đổi.
- Các thao tác xem chi tiết task và log work vẫn hoạt động như trước.

## Ngoài phạm vi

- Không đổi endpoint, JQL, phân trang hoặc dữ liệu Jira.
- Không thêm trường lọc mới.
- Không lưu trạng thái mở/đóng hoặc bộ lọc qua lần tải lại trang.
- Không refactor các phần khác của màn Browse Tasks.
