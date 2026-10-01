# Jira Dashboard

Chọn ngôn ngữ / Choose your language:
- [English](README.md)
- [Tiếng Việt](README.vi-VN.md)

[![Node.js 22+](https://img.shields.io/badge/Node.js-22%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-000000?logo=next.js&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Docker Hub](https://img.shields.io/badge/Docker%20Hub-minhnn03%2Fjira--dashboard-2496ED?logo=docker&logoColor=white)](https://hub.docker.com/r/minhnn03/jira-dashboard)
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

```

## 🐳 Docker

Dockerfile dùng multi-stage build. Image không chứa file env: truyền env khi chạy container.

### Chạy từ Docker Hub

Image: [minhnn03/jira-dashboard](https://hub.docker.com/r/minhnn03/jira-dashboard) (tag: `latest`, `1.15.11`)

1. Tạo file env (image không chứa env)
   ```bash
   curl -o .env https://raw.githubusercontent.com/minhnnguyen003/jira-dashboard/main/.env.example
   ```
   Sau đó sửa file. Bắt buộc có: `JIRA_BASE_URL` và một trong hai: `JIRA_BEARER_TOKEN` hoặc `JIRA_EMAIL` + `JIRA_API_TOKEN`.
2. Pull và chạy
   ```bash
   docker pull minhnn03/jira-dashboard:latest
   docker run -d --name jira-dashboard -p 3000:3000 --env-file .env --restart unless-stopped minhnn03/jira-dashboard:latest
   ```
3. Mở http://localhost:3000

Nên ghim version cụ thể khi chạy production: `minhnn03/jira-dashboard:1.15.11`.

Dùng Docker Compose (lưu thành `docker-compose.yml` cạnh file `.env`):

```yaml
services:
  jira-dashboard:
    image: minhnn03/jira-dashboard:latest
    ports:
      - "3000:3000"
    env_file: .env
    restart: unless-stopped
```

```bash
docker compose up -d
```

Cập nhật image mới:

```bash
docker compose pull && docker compose up -d
# hoặc dùng docker thuần
docker pull minhnn03/jira-dashboard:latest && docker rm -f jira-dashboard && docker run -d --name jira-dashboard -p 3000:3000 --env-file .env --restart unless-stopped minhnn03/jira-dashboard:latest
```

### Build image

```bash
docker build -t jira-dashboard .
```

### Chạy bằng docker

```bash
docker run -d -p 3000:3000 --env-file .env.prod jira-dashboard
```

### Docker Compose

```bash
docker compose up -d --build                        # dùng .env.local
ENV_FILE=.env.prod HOST_PORT=3001 docker compose up -d
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
