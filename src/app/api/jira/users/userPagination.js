function normalizeUser(user) {
  const name = typeof user?.name === 'string' ? user.name : '';
  const email = typeof user?.emailAddress === 'string' && user.emailAddress ? user.emailAddress : name;
  const avatarUrl = user?.avatarUrls?.['48x48'];

  return {
    name,
    displayName: typeof user?.displayName === 'string' && user.displayName ? user.displayName : name,
    email,
    avatarUrl: typeof avatarUrl === 'string' ? avatarUrl : '',
  };
}

function userIdentity(user) {
  return (user.email || user.name).trim().toLocaleLowerCase();
}

export function normalizeJiraUsers(rawUsers) {
  if (!Array.isArray(rawUsers)) {
    throw new TypeError('Expected Jira users page to be an array');
  }

  const seen = new Set();
  return rawUsers.map(normalizeUser).filter((user) => {
    const identity = userIdentity(user);
    if (!identity || seen.has(identity)) {
      return false;
    }

    seen.add(identity);
    return true;
  });
}

export async function fetchAllJiraUsers(fetchPage, pageSize = 100, maxPages = 1000, options = {}) {
  if (!Number.isSafeInteger(maxPages) || maxPages < 1) {
    throw new RangeError('maxPages must be a positive integer');
  }

  const users = [];
  const seen = new Set();
  let startAt = 0;
  let dataPages = 0;

  while (true) {
    const rawPage = await fetchPage({ startAt, maxResults: pageSize, signal: options.signal });
    const page = normalizeJiraUsers(rawPage);

    if (rawPage.length === 0) {
      break;
    }

    if (dataPages >= maxPages) {
      throw new Error(`Jira users pagination exceeded the maximum of ${maxPages} Jira users pages`);
    }
    dataPages += 1;

    for (const user of page) {
      const identity = userIdentity(user);
      if (!seen.has(identity)) {
        seen.add(identity);
        users.push(user);
      }
    }

    startAt += rawPage.length;
  }

  return users;
}
