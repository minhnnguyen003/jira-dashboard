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
  return { query, snapshot };
}

export function chooseAssigneeInputState(user) {
  const value = user ? user.email || user.name : '';
  return createAssigneeInputState(createAssigneeInputSnapshot(value, user));
}

export function isAssigneeBlurGenerationCurrent(scheduledGeneration, currentGeneration) {
  return scheduledGeneration === currentGeneration;
}

export function runAssigneeBlurIfCurrent(scheduledGeneration, currentGeneration, apply) {
  if (!isAssigneeBlurGenerationCurrent(scheduledGeneration, currentGeneration)) return false;
  apply();
  return true;
}
