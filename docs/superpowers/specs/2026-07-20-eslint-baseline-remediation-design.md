# Thiết kế làm sạch ESLint baseline

## Bối cảnh

Baseline `npm run lint` hiện thất bại ổn định với 60 lỗi và 23 cảnh báo. Điều tra git history, package lock và cấu hình cho thấy đây là technical debt tích lũy trong code, không phải regression từ tính năng combobox Assignee.

Phân bố 60 lỗi:

- 38 lỗi `@typescript-eslint/no-explicit-any` trên các Jira API route và `src/lib/jira/api.ts`.
- 20 lỗi `react-hooks/set-state-in-effect` trên các page/component React và `src/lib/i18n.tsx`.
- 1 lỗi `react-hooks/refs` và 1 lỗi `react-hooks/immutability` trong `TaskDetailModal.tsx`.

## Mục tiêu

Đưa `npm run lint` về exit code 0 bằng cách sửa code tận gốc, không tắt hoặc hạ severity rule ESLint, đồng thời giữ nguyên contract API và hành vi UI hiện tại.

Sau khi baseline sạch, tiếp tục triển khai combobox Assignee theo spec và plan đã duyệt.

## Phương án được chọn

Chia remediation thành ba lát có thể kiểm thử và review độc lập:

1. Kiểu dữ liệu và lỗi API.
2. State đồng bộ trong React effects.
3. Ref/mutation trong `TaskDetailModal`.

Không chỉnh ESLint config để che lỗi. Không gộp refactor ngoài những gì cần thiết để các rule hiện tại pass.

## Lát 1: Kiểu dữ liệu và lỗi API

- Thay annotation `any` của catch bằng `unknown` hoặc bỏ annotation.
- Dùng `axios.isAxiosError` trước khi đọc `response`, `code` hoặc payload lỗi.
- Dùng `instanceof Error` cho lỗi JavaScript thông thường.
- Thay `any` trong Jira response/payload bằng interface tối thiểu hoặc `Record<string, unknown>` kèm narrowing tại điểm sử dụng.
- Giữ nguyên HTTP status, JSON shape và nội dung thông báo lỗi mà caller đang nhận.
- Không tạo một mô hình Jira domain mới nếu chỉ một route cần kiểu cục bộ.

## Lát 2: React state trong effects

Mỗi lỗi được phân loại theo luồng dữ liệu thay vì áp dụng một cách sửa chung:

- Giá trị đọc đồng bộ từ cookie/localStorage dùng lazy initializer hoặc hàm đọc ban đầu phù hợp với client hydration.
- Giá trị có thể suy ra từ props/state khác dùng derived value hoặc `useMemo`, không lưu state trùng lặp.
- Reset state do thay đổi input được chuyển sang event handler đã tạo ra thay đổi đó khi có thể.
- Kết quả fetch vẫn cập nhật state trong callback promise/async, không cập nhật đồng bộ trực tiếp trong thân effect.
- Trường hợp modal cần reset theo lần mở dùng key/lifecycle boundary hoặc event mở/đóng thay vì effect reset hàng loạt.

Hành vi nhìn thấy bởi người dùng, timing debounce, giá trị mặc định và contract props phải giữ nguyên.

## Lát 3: TaskDetailModal ref và mutation

- Không đọc `ref.current` trong render để tạo giá trị UI.
- Dữ liệu cần render được biểu diễn bằng state hoặc giá trị thuần từ props/state.
- Không mutate object hoặc biến mà React/compiler coi là immutable.
- Loại đường dẫn sử dụng biến/hàm trước khi khai báo bằng cách sắp xếp lại dependency hoặc tách helper thuần.
- Giữ nguyên luồng xem/sửa issue, refresh issue và mở Log Work.

## Kiểm thử và review

Mỗi lát phải:

- Chạy lint trên các file vừa thay đổi.
- Chạy các Node tests liên quan hiện có; bổ sung regression test cho helper được tách ra khi có logic mới.
- Chạy TypeScript `npx tsc --noEmit` nếu thay đổi type hoặc component.
- Có commit riêng và qua review spec compliance + code quality.

Sau cả ba lát:

- Chạy `node --test`.
- Chạy `npx tsc --noEmit`.
- Chạy `npm run lint` và yêu cầu exit code 0; warnings hiện hữu có thể còn nhưng không được tăng do thay đổi mới.
- Chạy `npm run build`.

## Tiêu chí hoàn thành

- Không còn 60 ESLint errors hiện hữu.
- Không thêm ESLint disable comment hoặc thay đổi config/rule severity.
- API routes giữ nguyên status và response shape.
- Các màn/form/modal giữ nguyên hành vi người dùng hiện tại.
- Toàn bộ test, typecheck, lint và build pass trước khi bắt đầu code combobox.

## Ngoài phạm vi

- Không bắt buộc xử lý 23 warnings hiện hữu nếu chúng không chặn lint.
- Không nâng/hạ dependency.
- Không thiết kế lại domain types Jira toàn dự án.
- Không refactor UI, copy hoặc styling không liên quan.
- Không sửa ba cảnh báo bảo mật dependency từ `npm audit` trong đợt này.
