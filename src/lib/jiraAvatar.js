export function buildJiraAvatarProxyUrl(avatarUrl) {
  if (!avatarUrl) {
    return '';
  }

  return `/api/jira/avatar?src=${encodeURIComponent(avatarUrl)}`;
}
