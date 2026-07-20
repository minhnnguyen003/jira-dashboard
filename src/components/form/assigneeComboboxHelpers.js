function normalize(value) {
  return String(value || '').trim().toLocaleLowerCase();
}

/**
 * @typedef {{ name: string, displayName: string, email: string, avatarUrl?: string }} AssigneeUser
 */

/**
 * @param {AssigneeUser[]} users
 * @param {string} query
 */
export function filterAssigneeUsers(users, query) {
  const needle = normalize(query);
  if (!needle) return users;

  return users.filter((user) => [user.displayName, user.name, user.email]
    .some((value) => normalize(value).includes(needle)));
}

/**
 * @param {AssigneeUser[]} users
 * @param {string} query
 * @param {AssigneeUser | null} [selected]
 */
export function resolveAssigneeInput(users, query, selected = null) {
  const needle = normalize(query);
  if (!needle) return null;
  if (selected && needle === normalize(selected.displayName)) return selected;

  return users.find((user) => normalize(user.name) === needle || normalize(user.email) === needle) || null;
}

export function createAssigneeInputSnapshot(value, selected) {
  return {
    value,
    identity: selected ? selected.email || selected.name : '',
    displayName: selected?.displayName || '',
  };
}

export function createAssigneeInputState(snapshot) {
  return { query: snapshot.displayName, snapshot };
}

function hasSameAssigneeSnapshot(left, right) {
  return left.value === right.value
    && left.identity === right.identity
    && left.displayName === right.displayName;
}

export function reconcileAssigneeInputState(state, snapshot) {
  return hasSameAssigneeSnapshot(state.snapshot, snapshot)
    ? state
    : createAssigneeInputState(snapshot);
}

export function editAssigneeInputState(snapshot, query) {
  if (query === snapshot.displayName) {
    return { query, snapshot };
  }

  return { query, snapshot: createAssigneeInputSnapshot('', null) };
}

export function chooseAssigneeInputState(user) {
  const value = user ? user.email || user.name : '';
  return createAssigneeInputState(createAssigneeInputSnapshot(value, user));
}
