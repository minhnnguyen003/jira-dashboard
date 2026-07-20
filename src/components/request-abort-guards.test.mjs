import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function readSource(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

function countMatches(source, pattern) {
  return [...source.matchAll(pattern)].length;
}

function assertFetchUsesSignal(source, endpoint) {
  const fetchOffset = source.indexOf(endpoint);
  assert.notEqual(fetchOffset, -1, `Không tìm thấy endpoint ${endpoint}`);
  const fetchBlock = source.slice(fetchOffset, fetchOffset + 500);
  assert.match(fetchBlock, /signal:\s*controller\.signal/, `${endpoint} phải truyền AbortSignal vào fetch`);
}

function assertAbortCoverage({ source, controllerCount, endpoints }) {
  assert.equal(countMatches(source, /new AbortController\(\)/g), controllerCount);
  assert.equal(countMatches(source, /controller\.abort\(\)/g), controllerCount);
  assert.ok(
    countMatches(source, /controller\.signal\.aborted/g) >= controllerCount,
    'Mỗi request effect phải chặn stale finally/state update sau khi abort',
  );
  assert.match(source, /function isAbortError\(/, 'AbortError phải được nhận diện và bỏ qua rõ ràng');
  assert.ok(
    countMatches(source, /if \(controller\.signal\.aborted\) return;/g) >= endpoints.length,
    'Mỗi response phải kiểm tra signal ngay trước khi ghi data để chặn callback đã được xếp hàng',
  );
  endpoints.forEach((endpoint) => assertFetchUsesSignal(source, endpoint));
}

test('ProfileSetupModal aborts stale user searches', () => {
  assertAbortCoverage({
    source: readSource('./profile/ProfileSetupModal.tsx'),
    controllerCount: 1,
    endpoints: ['/api/jira/users?query='],
  });
});

test('CreateTaskModal aborts stale user and project-dependent requests', () => {
  assertAbortCoverage({
    source: readSource('./modal/CreateTaskModal.tsx'),
    controllerCount: 3,
    endpoints: [
      '/api/jira/users?query=',
      '/api/jira/tasks?project=',
      '/api/jira/epics?project=',
      '/api/jira/sprints?project=',
    ],
  });
});

test('create-task page aborts stale user and project-dependent requests', () => {
  assertAbortCoverage({
    source: readSource('../app/create-task/page.tsx'),
    controllerCount: 4,
    endpoints: [
      '/api/jira/users?query=',
      '/api/jira/tasks?project=',
      '/api/jira/epics?project=',
      '/api/jira/components?project=',
      '/api/jira/sprints?project=',
    ],
  });
});
