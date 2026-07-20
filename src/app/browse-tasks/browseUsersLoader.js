/**
 * @typedef {{ name: string, displayName: string, email: string, avatarUrl?: string }} BrowseUser
 */

/**
 * @param {() => Promise<BrowseUser[]>} requestUsers
 * @returns {() => Promise<BrowseUser[]>}
 */
export function createBrowseUsersLoader(requestUsers) {
  /** @type {Promise<BrowseUser[]> | null} */
  let usersPromise = null;

  return function loadUsers() {
    if (!usersPromise) {
      usersPromise = Promise.resolve()
        .then(requestUsers)
        .finally(() => {
          usersPromise = null;
        });
    }

    return usersPromise;
  };
}

async function requestBrowseUsers() {
  const response = await fetch('/api/jira/users?all=true');
  if (!response.ok) throw new Error(`Users API error: ${response.status}`);
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

export const loadBrowseUsers = createBrowseUsersLoader(requestBrowseUsers);

/**
 * @param {Promise<BrowseUser[]>} usersPromise
 * @param {() => boolean} isActive
 * @param {{
 *   onSuccess: (users: BrowseUser[]) => void,
 *   onError: () => void,
 *   onSettled: () => void,
 * }} handlers
 */
export async function consumeBrowseUsers(usersPromise, isActive, handlers) {
  try {
    const users = await usersPromise;
    if (isActive()) handlers.onSuccess(users);
  } catch {
    if (isActive()) handlers.onError();
  } finally {
    if (isActive()) handlers.onSettled();
  }
}
