# Jira Dashboard

Dashboard giám sát công việc Jira với biểu đồ bar chart và bảng dữ liệu có phân trang. Hiển thị tổng hợp thời gian ước lượng (estimated) và thời gian đã đăng ký (logged) theo assignee, sprint hoặc status.

## Tính năng

- Truy vấn Jira qua JQL
- Biểu đồ bar chart so sánh Estimated vs Logged time
- Bảng dữ liệu có phân trang và sắp xếp
- Phân nhóm theo: Assignee, Sprint, Status
- Hỗ trợ Bearer Token và Basic Auth

## Môi trường

- Node.js 22+
- Next.js 16 (App Router)
- Chart.js 4 + react-chartjs-2
- TypeScript

## Cài đặt

### Yêu cầu

- Node.js 22+
- Tài khoản Jira Cloud hoặc Jira Server
- API Token hoặc Bearer Token

### Cấu hình

1. Copy file environment:

```bash
cp .env.example .env.local
```

2. Chỉnh sửa `.env.local`:

```env
# URL Jira instance
JIRA_BASE_URL=https://your-domain.atlassian.net

# Bearer Token (khuyến nghị)
JIRA_BEARER_TOKEN=your-bearer-token-here

# Hoặc Basic Auth (email:api_token)
JIRA_EMAIL=your-email@company.com
JIRA_API_TOKEN=your-api-token-here

# URL công khai cho link issues
NEXT_PUBLIC_JIRA_BASE_URL=https://your-domain.atlassian.net
```

3. Cài đặt dependencies:

```bash
npm install
```

4. Chạy dev server:

```bash
npm run dev
```

Truy cập `http://localhost:3000`

## Docker

### Cấu trúc build

Dockerfile dùng multi-stage build với 4 stages: `base` → `deps` → `builder` → `runner`.
Support 3 chế độ environment qua `--build-arg ENV_ENV`:

| Mode | File env | Mục đích |
|---|---|---|
| `local` | `.env.local` | Build với env file embedded trong image |
| `prod` | `.env.prod` | Build với prod env file embedded |
| `runtime` | không có | Truyền env qua `-e` hoặc `docker-compose` environment variables |

### Build image

```bash
# Build với local env (embedded trong image)
docker build --build-arg ENV_ENV=local -t jira-dashboard:local .

# Build với prod env (embedded trong image)
docker build --build-arg ENV_ENV=prod -t jira-dashboard:prod .

# Build không embed env (truyền runtime)
docker build --build-arg ENV_ENV=runtime -t jira-dashboard:runtime .
```

### Chạy đơn giản

```bash
docker run -d \
  -p 3000:3000 \
  --name jira-dashboard \
  -e JIRA_BASE_URL=https://your-domain.atlassian.net \
  -e JIRA_BEARER_TOKEN=your-bearer-token \
  -e NEXT_PUBLIC_JIRA_BASE_URL=https://your-domain.atlassian.net \
  jira-dashboard:runtime
```

### Docker Compose

File `docker-compose.yml` có sẵn 3 services:

| Service | Port | Environment |
|---|---|---|
| `jira-dashboard-local` | 3000 | `.env.local` + `ENV_ENV=local` |
| `jira-dashboard-prod` | 3001 | `.env.prod` + `ENV_ENV=prod` |
| `jira-dashboard-runtime` | 3002 | Inline env vars + `ENV_ENV=runtime` |

Chạy từng service:

```bash
# Local dev environment
docker compose up -d --build jira-dashboard-local

# Production environment (build image với .env.prod)
docker compose up -d --build jira-dashboard-prod

# Runtime environment (truyền env từ command line)
docker compose up -d --build jira-dashboard-runtime
```

Chạy tất cả services:

```bash
docker compose up -d --build
```

Dừng và xóa containers:

```bash
docker compose down
# Hoặc xóa cả volumes:
docker compose down -v
```

#### Tùy chỉnh ports

Nếu port 3000/3001/3002 đã được dùng, edit `docker-compose.yml`:

```yaml
ports:
  - "3000:3000"   # đổi thành port khác như 8080:3000
```

## Cấu trúc project

```
JiraDashboard/
├── .planning/
│   ├── AGENTS.md
│   └── Convention.md
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout
│   │   ├── page.tsx                # Dashboard page
│   │   ├── globals.css             # Global styles
│   │   └── api/jira/search/route.ts # API route
│   ├── components/
│   │   ├── chart/
│   │   │   └── JiraBarChart.tsx    # Bar chart component
│   │   └── table/
│   │       └── JiraTable.tsx       # Table + pagination
│   ├── lib/
│   │   └── jira/
│   │       └── api.ts              # Jira API client
│   └── types/
│       └── jira.ts                 # TypeScript types
├── Dockerfile
├── .env.example
├── docker-compose.yml
└── package.json
```

## API Routes

### GET /api/jira/search

Tìm kiếm issues từ Jira qua JQL.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `jql` | string | `project = YOUR_PROJECT ORDER BY updated DESC` | JQL query |
| `groupBy` | string | `assignee` | Phân nhóm: assignee, sprint, status |
| `startAt` | number | `0` | Offset cho pagination |
| `maxResults` | number | `50` | Số issues tối đa |

**Response:**

```json
{
  "issues": [
    {
      "key": "PROJ-123",
      "summary": "Example issue",
      "status": "In Progress",
      "assignee": "John Doe",
      "priority": "High",
      "estimated": "4h",
      "logged": "2h",
      "sprint": "Sprint 1"
    }
  ],
  "aggregated": [
    {
      "label": "John Doe",
      "estimatedSeconds": 14400,
      "loggedSeconds": 7200
    }
  ],
  "total": 10
}
```

## Cách sử dụng

1. Mở Dashboard tại `http://localhost:3000`
2. Nhập JQL query (ví dụ: `project = SCRUM AND status != Done`)
3. Chọn "Group By" để phân nhóm biểu đồ
4. Nhấn **Search** để tải dữ liệu
5. Xem biểu đồ bar chart và bảng dữ liệu
6. Sắp xếp cột và phân trang trong bảng

## JQL examples

```
# Tất cả issues trong project
project = YOUR_PROJECT_KEY

# Issues chưa done
project = YOUR_PROJECT_KEY AND status != Done

# Issues trong sprint hiện tại
project = YOUR_PROJECT_KEY AND sprint in openSprints()

# Issues do một assignee đảm nhiệm
assignee = currentUser()

# Issues có priority cao
project = YOUR_PROJECT_KEY AND priority in (High, Highest)

# Issues created trong 30 ngày qua
project = YOUR_PROJECT_KEY AND created >= -30d
```

## Deploy

### Vercel (khuyến nghị)

```bash
npm i -g vercel
vercel
```

Đặt environment variables trong Vercel Dashboard hoặc khi deploy:

```bash
vercel --env JIRA_BASE_URL=https://your-domain.atlassian.net
vercel --env JIRA_BEARER_TOKEN=your-token
```

### Docker (Railway, Render, AWS ECS)

```bash
docker build -t your-registry/jira-dashboard:latest .
docker push your-registry/jira-dashboard:latest
```

## Development

```bash
# Run dev server
npm run dev

# Build production
npm run build

# Start production server
npm start

# Lint
npm run lint
```

## Troubleshooting

### Lỗi 401 Unauthorized

- Kiểm tra `JIRA_BEARER_TOKEN` hoặc `JIRA_EMAIL` + `JIRA_API_TOKEN`
- Token có thể đã hết hạn
- Tài khoản có thể không có quyền truy cập project

### Lỗi 404 Not Found

- Kiểm tra `JIRA_BASE_URL` có đúng định dạng
- URL phải là `https://domain.atlassian.net` (không có `/rest/api/3`)

### Lỗi CORS

- Dashboard chạy API route trên server (Next.js API route)
- Không cần cấu hình CORS cho Jira Cloud

### Chart không hiển thị

- Đảm bảo `react-chartjs-2` và `chart.js` đã cài đặt
- Kiểm tra dữ liệu từ API có hợp lệ

## License

MIT
