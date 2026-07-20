function normalizeUser(user) {
  const name = typeof user?.name === 'string' ? user.name : '';
  const email = typeof user?.emailAddress === 'string' && user.emailAddress ? user.emailAddress : name;

  return {
    name,
    displayName: typeof user?.displayName === 'string' && user.displayName ? user.displayName : name,
    email,
    avatarUrl: user?.avatarUrls?.['48x48'] || '',
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

export async function fetchAllJiraUsers(fetchPage, pageSize = 100) {
  const users = [];
  const seen = new Set();
  let startAt = 0;

  while (true) {
    const rawPage = await fetchPage({ startAt, maxResults: pageSize });
    const page = normalizeJiraUsers(rawPage);

    for (const user of page) {
      const identity = userIdentity(user);
      if (!seen.has(identity)) {
        seen.add(identity);
        users.push(user);
      }
    }

    if (rawPage.length === 0) {
      break;
    }

    startAt += rawPage.length;
  }

  return users;
}
