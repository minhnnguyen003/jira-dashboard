# Jira Dashboard

Choose your language / Chọn ngôn ngữ:
- [English](README.md)
- [Tiếng Việt](README.vi-VN.md)

[![Node.js 22+](https://img.shields.io/badge/Node.js-22%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-000000?logo=next.js&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Docker Hub](https://img.shields.io/badge/Docker%20Hub-minhnn03%2Fjira--dashboard-2496ED?logo=docker&logoColor=white)](https://hub.docker.com/r/minhnn03/jira-dashboard)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> A modern Jira work monitoring dashboard built with Next.js, TypeScript, and Chart.js.

## ✨ Highlights

- Query Jira issues using JQL
- Compare Estimated vs Logged time in interactive bar charts
- View and sort data in a paginated table
- Group results by Assignee, Sprint, or Status
- Support Bearer Token and Basic Auth

## 🚀 Quick Start

For new users, this is the fastest way to get the app running locally.

1. Install dependencies
   ```bash
   npm install
   ```
2. Copy the environment sample file
   ```bash
   cp .env.example .env.local
   ```
3. Fill in your Jira credentials in `.env.local`
   ```env
   JIRA_BASE_URL=https://your-domain.atlassian.net
   JIRA_BEARER_TOKEN=your-bearer-token-here
   ```
4. Start the development server
   ```bash
   npm run dev
   ```

Open http://localhost:3000 to view the dashboard.

## 🛠️ Requirements

- Node.js 22+
- Jira Cloud or Jira Server account
- API Token or Bearer Token

## ⚙️ Configuration

### Environment variables

```env
# Jira instance URL
JIRA_BASE_URL=https://your-domain.atlassian.net

# Bearer Token (recommended)
JIRA_BEARER_TOKEN=your-bearer-token-here

# Or Basic Auth (email:api_token)
JIRA_EMAIL=your-email@company.com
JIRA_API_TOKEN=your-api-token-here

```

## 🐳 Docker

The Dockerfile uses a multi-stage build. No env file is baked into the image: pass env when running the container.

### Run from Docker Hub

Image: [minhnn03/jira-dashboard](https://hub.docker.com/r/minhnn03/jira-dashboard) (tags: `latest`, `1.15.11`)

1. Create an env file (no env is baked into the image)
   ```bash
   curl -o .env https://raw.githubusercontent.com/minhnnguyen003/jira-dashboard/main/.env.example
   ```
   Then edit it. Required: `JIRA_BASE_URL` and either `JIRA_BEARER_TOKEN` or `JIRA_EMAIL` + `JIRA_API_TOKEN`.
2. Pull and run
   ```bash
   docker pull minhnn03/jira-dashboard:latest
   docker run -d --name jira-dashboard -p 3000:3000 --env-file .env --restart unless-stopped minhnn03/jira-dashboard:latest
   ```
3. Open http://localhost:3000

Pin a specific version for production: `minhnn03/jira-dashboard:1.15.11`.

Using Docker Compose (save as `docker-compose.yml` next to your `.env`):

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

Update to a newer image:

```bash
docker compose pull && docker compose up -d
# or with plain docker
docker pull minhnn03/jira-dashboard:latest && docker rm -f jira-dashboard && docker run -d --name jira-dashboard -p 3000:3000 --env-file .env --restart unless-stopped minhnn03/jira-dashboard:latest
```

### Build image

```bash
docker build -t jira-dashboard .
```

### Run with docker

```bash
docker run -d -p 3000:3000 --env-file .env.prod jira-dashboard
```

### Docker Compose

```bash
docker compose up -d --build                        # uses .env.local
ENV_FILE=.env.prod HOST_PORT=3001 docker compose up -d
```

## 📁 Project structure

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

Search issues from Jira using JQL.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `jql` | string | `project = YOUR_PROJECT ORDER BY updated DESC` | JQL query |
| `groupBy` | string | `assignee` | Group by: assignee, sprint, status |
| `startAt` | number | `0` | Offset for pagination |
| `maxResults` | number | `50` | Maximum number of issues |

## 🧪 Development

```bash
npm run dev
npm run build
npm run lint
```

## 🚧 Troubleshooting

- `401 Unauthorized`: check `JIRA_BEARER_TOKEN` or your Jira credentials
- `404 Not Found`: verify `JIRA_BASE_URL`
- `Chart not displaying`: confirm the API response contains valid data

## 📄 License

MIT
