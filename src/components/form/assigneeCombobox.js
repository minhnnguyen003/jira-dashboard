function normalize(value) {
  return String(value || '').trim().toLocaleLowerCase();
}

export function filterAssigneeUsers(users, query) {
  const needle = normalize(query);
  if (!needle) return users;

  return users.filter((user) => [user.displayName, user.name, user.email]
    .some((value) => normalize(value).includes(needle)));
}

export function resolveAssigneeInput(users, query) {
  const needle = normalize(query);
  if (!needle) return null;

  return users.find((user) => normalize(user.name) === needle || normalize(user.email) === needle) || null;
}
