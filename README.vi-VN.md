# Jira Dashboard

Chọn ngôn ngữ / Choose your language:
- [English](README.md)
- [Tiếng Việt](README.vi-VN.md)

[![Node.js 22+](https://img.shields.io/badge/Node.js-22%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-000000?logo=next.js&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> Dashboard giám sát công việc Jira hiện đại, được xây dựng bằng Next.js, TypeScript và Chart.js.

## ✨ Điểm nổi bật

- Truy vấn issue Jira bằng JQL
- So sánh Estimated và Logged time bằng biểu đồ cột tương tác
- Xem và sắp xếp dữ liệu trong bảng có phân trang
- Nhóm kết quả theo Assignee, Sprint hoặc Status
- Hỗ trợ Bearer Token và Basic Auth

## 🚀 Quick Start

Đối với người dùng mới, đây là cách nhanh nhất để chạy ứng dụng ở môi trường local.

1. Cài đặt dependencies
   ```bash
   npm install
   ```
2. Sao chép file môi trường mẫu
   ```bash
   cp .env.example .env.local
   ```
3. Điền thông tin Jira vào `.env.local`
   ```env
   JIRA_BASE_URL=https://your-domain.atlassian.net
   JIRA_BEARER_TOKEN=your-bearer-token-here
   NEXT_PUBLIC_JIRA_BASE_URL=https://your-domain.atlassian.net
   ```
4. Khởi động server phát triển
   ```bash
   npm run dev
   ```

Mở http://localhost:3000 để xem dashboard.

## 🛠️ Yêu cầu

- Node.js 22+
- Tài khoản Jira Cloud hoặc Jira Server
- API Token hoặc Bearer Token

## ⚙️ Cấu hình

### Biến môi trường

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

## 🐳 Docker

Dockerfile dùng multi-stage build với 4 stages: `base` → `deps` → `builder` → `runner`.
Hỗ trợ 3 chế độ environment qua `--build-arg ENV_ENV`:

| Mode | File env | Mục đích |
|---|---|---|
| `local` | `.env.local` | Build với env file embedded trong image |
| `prod` | `.env.prod` | Build với prod env file embedded |
| `runtime` | không có | Truyền env qua `-e` hoặc `docker-compose` |

### Build image

```bash
# Build với local env
docker build --build-arg ENV_ENV=local -t jira-dashboard:local .

# Build với prod env
docker build --build-arg ENV_ENV=prod -t jira-dashboard:prod .

# Build không embed env
docker build --build-arg ENV_ENV=runtime -t jira-dashboard:runtime .
```

### Docker Compose

```bash
docker compose up -d --build
```

## 📁 Cấu trúc project

```text
JiraDashboard/
├── src/
│   ├── app/
│   ├── components/
│   ├── lib/
│   └── types/
├── Dockerfile
├── docker-compose.yml
└── package.json
```

## 🔌 API route

### GET /api/jira/search

Tìm kiếm issues từ Jira qua JQL.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `jql` | string | `project = YOUR_PROJECT ORDER BY updated DESC` | JQL query |
| `groupBy` | string | `assignee` | Phân nhóm: assignee, sprint, status |
| `startAt` | number | `0` | Offset cho pagination |
| `maxResults` | number | `50` | Số issues tối đa |

## 🧪 Development

```bash
npm run dev
npm run build
npm run lint
```

## 🚧 Troubleshooting

- `401 Unauthorized`: kiểm tra `JIRA_BEARER_TOKEN` hoặc thông tin Jira
- `404 Not Found`: kiểm tra `JIRA_BASE_URL`
- `Chart không hiển thị`: đảm bảo API trả về dữ liệu hợp lệ

## 📄 License

MIT
