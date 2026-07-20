import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const readRoute = (route) => readFile(path.join(process.cwd(), 'src/app/api/jira', route, 'route.ts'), 'utf8');

test('browse-tasks và work-tasks giữ nguyên object issuetype và fallback timestamp null', async () => {
  for (const route of ['browse-tasks', 'work-tasks']) {
    const source = await readRoute(route);
    assert.match(source, /issuetype: fields\?\.issuetype \|\| \{ name: 'Issue', iconUrl: '' \}/);
    assert.match(source, /created: fields\?\.created \|\| null/);
    assert.match(source, /updated: fields\?\.updated \|\| null/);
  }
});

test('hours-by-date fullIssues giữ issuetype và đưa 0 hoặc chuỗi rỗng về null', async () => {
  const source = await readRoute('hours-by-date');
  assert.match(source, /issuetype: fields\?\.issuetype \|\| \{ name: 'Issue', iconUrl: '' \}/);
  assert.match(source, /timeestimate: fields\?\.timeestimate \|\| null/);
  assert.match(source, /timespent: fields\?\.timespent \|\| null/);
  assert.match(source, /timeoriginalestimate: fields\?\.timeoriginalestimate \|\| null/);
});

test('hours-by-date chặn Jira search response không có issues array', async () => {
  const source = await readRoute('hours-by-date');
  assert.equal((source.match(/if \(!Array\.isArray\(issuePage\)\)/g) || []).length, 2);
  assert.equal((source.match(/returned an empty page before total/g) || []).length, 2);
});
