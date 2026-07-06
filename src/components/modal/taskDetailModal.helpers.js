export function getDescriptionPlaceholder(description, language) {
  if (typeof description === 'string' && description.trim()) {
    return '';
  }

  return language === 'en' ? 'No description' : 'Không có mô tả';
}

export async function runIssueRefresh(issue, onRefresh) {
  if (!issue || typeof onRefresh !== 'function') {
    return issue ?? null;
  }

  const refreshedIssue = await onRefresh(issue);
  return refreshedIssue ?? issue;
}
