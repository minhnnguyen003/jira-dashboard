# Hours By Date Profile Cookie Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuyển màn `statistics/hours-by-date` từ `worklogAuthor = currentUser()` sang dùng `jira_email` trong profile cookie.

**Architecture:** Tách helper build author clause để test độc lập, sau đó để API `hours-by-date` đọc cookie trực tiếp từ `NextRequest` và dùng email đó trong JQL. Frontend không cần truyền thêm danh tính.

**Tech Stack:** Next.js App Router route handler, profile cookie helper, Node test runner.

---
