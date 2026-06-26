# Các trường dữ liệu cơ bản của một task trong Jira

## Các trường dữ liệu cơ bản của một task

| ID               | Tên hiển thị      | Kiểu dữ liệu  | Mô tả                         |
| ---------------- | ----------------- | ------------- | ----------------------------- |
| `issuekey`       | Key               | String        | Mã task, ví dụ `ABC-123`      |
| `summary`        | Summary           | String        | Tiêu đề task                  |
| `issuetype`      | Issue Type        | IssueType     | Task, Bug, Story, Sub-task... |
| `status`         | Status            | Status        | Trạng thái hiện tại           |
| `assignee`       | Assignee          | User          | Người được giao               |
| `reporter`       | Reporter          | User          | Người tạo                     |
| `creator`        | Creator           | User          | Người khởi tạo                |
| `priority`       | Priority          | Priority      | Mức độ ưu tiên                |
| `resolution`     | Resolution        | Resolution    | Kết quả xử lý                 |
| `created`        | Created           | Datetime      | Ngày tạo                      |
| `updated`        | Updated           | Datetime      | Ngày cập nhật cuối            |
| `resolutiondate` | Resolved          | Datetime      | Ngày hoàn thành               |
| `labels`         | Labels            | Array<String> | Nhãn gắn trên task            |
| `description`    | Description       | Text          | Mô tả chi tiết                |
| `project`        | Project           | Project       | Dự án                         |
| `components`     | Component/s       | Array         | Thành phần hệ thống           |
| `fixVersions`    | Fix Version/s     | Array         | Phiên bản fix                 |
| `versions`       | Affects Version/s | Array         | Phiên bản bị ảnh hưởng        |
| `subtasks`       | Sub-Tasks         | Array         | Danh sách subtask             |
| `issuelinks`     | Linked Issues     | Array         | Các issue liên kết            |

## Các trường thời gian

| ID | Tên hiển thị | Đơn vị | Mô tả |
| ------------------------------- | -------------------- | ------ | ----------------------------- |
| `timeoriginalestimate`          | Original Estimate    | Giây   | Ước lượng ban đầu             |
| `timeestimate`                  | Remaining Estimate   | Giây   | Thời gian còn lại             |
| `timespent`                     | Time Spent           | Giây   | Tổng thời gian đã log         |
| `timetracking`                  | Time Tracking        | Object | Bản format sẵn của Jira       |
| `worklog`                       | Log Work             | Array  | Chi tiết từng lần log         |
| `workratio`                     | Work Ratio           | %      | Tỷ lệ hoàn thành              |
| `progress`                      | Progress             | Object | Tiến độ task                  |
| `aggregateprogress`             | Σ Progress           | Object | Tiến độ tổng hợp              |
| `aggregatetimeoriginalestimate` | Σ Original Estimate  | Giây   | Estimate của task + subtask   |
| `aggregatetimeestimate`         | Σ Remaining Estimate | Giây   | Remaining của task + subtask  |
| `aggregatetimespent`            | Σ Time Spent         | Giây   | Time spent của task + subtask |

## Custom Field về Timeline

| ID                  | Tên hiển thị       | Kiểu     |
| ------------------- | ------------------ | -------- |
| `customfield_10300` | Start Date (Time)  | Datetime |
| `customfield_10302` | Due Date (Time)    | Datetime |
| `customfield_10301` | UAT Date (Time)    | Datetime |
| `customfield_10311` | Actual End date    | Datetime |
| `customfield_10307` | Start Date [Gantt] | Datetime |
| `customfield_10308` | End Date [Gantt]   | Datetime |

## Agile / Scrum

| ID                  | Tên hiển thị          | Kiểu   |
| ------------------- | --------------------- | ------ |
| `customfield_10206` | Sprint                | Array  |
| `customfield_10207` | Story Points          | Number |
| `customfield_10103` | Original story points | Number |
| `customfield_10201` | Epic Link             | String |
| `customfield_10203` | Epic Name             | String |
| `customfield_10202` | Epic Status           | Option |
| `customfield_10204` | Epic Colour           | String |
| `customfield_10205` | Rank                  | String |

## Ý nghĩa

| Cột                | Ý nghĩa                  |
| ------------------ | ------------------------ |
| Key                | Mã task                  |
| Summary            | Tên công việc            |
| Type               | Loại công việc           |
| Status             | Trạng thái               |
| Resolved           | Ngày hoàn thành          |
| Original Estimate  | Dự kiến ban đầu          |
| Time Spent         | Thời gian thực tế đã log |
| Remaining Estimate | Thời gian còn lại        |
| Start Date (Time)  | Ngày bắt đầu             |
| Due Date (Time)    | Deadline                 |
| Labels             | Nhãn phân loại           |
