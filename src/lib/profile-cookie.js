export const PROFILE_COOKIE_NAMES = {
  displayName: 'jira_display_name',
  email: 'jira_email',
  avatarUrl: 'jira_avatar_url',
};

export const PROFILE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365 * 2;

function parseCookieEntries(cookieString) {
  return String(cookieString || '')
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .reduce((acc, entry) => {
      const separatorIndex = entry.indexOf('=');
      if (separatorIndex === -1) {
        return acc;
      }

      const key = entry.slice(0, separatorIndex).trim();
      const value = entry.slice(separatorIndex + 1).trim();
      acc[key] = value;
      return acc;
    }, {});
}

export function getCookieValueFromString(cookieString, cookieName) {
  const cookies = parseCookieEntries(cookieString);
  const rawValue = cookies[cookieName];
  return rawValue ? decodeURIComponent(rawValue) : '';
}

export function parseProfileCookieString(cookieString) {
  const cookies = parseCookieEntries(cookieString);
  const rawDisplayName = cookies[PROFILE_COOKIE_NAMES.displayName];
  const rawEmail = cookies[PROFILE_COOKIE_NAMES.email];
  const rawAvatarUrl = cookies[PROFILE_COOKIE_NAMES.avatarUrl];

  if (!rawDisplayName) {
    return null;
  }

  return {
    displayName: decodeURIComponent(rawDisplayName),
    email: rawEmail ? decodeURIComponent(rawEmail) : '',
    avatarUrl: rawAvatarUrl ? decodeURIComponent(rawAvatarUrl) : '',
  };
}

export function buildProfileCookieAssignments(profile) {
  const encodedDisplayName = encodeURIComponent(profile.displayName || '');
  const encodedEmail = encodeURIComponent(profile.email || '');
  const encodedAvatarUrl = encodeURIComponent(profile.avatarUrl || '');
  const sharedAttributes = `Max-Age=${PROFILE_COOKIE_MAX_AGE_SECONDS}; Path=/; SameSite=Lax`;

  return [
    `${PROFILE_COOKIE_NAMES.displayName}=${encodedDisplayName}; ${sharedAttributes}`,
    `${PROFILE_COOKIE_NAMES.email}=${encodedEmail}; ${sharedAttributes}`,
    `${PROFILE_COOKIE_NAMES.avatarUrl}=${encodedAvatarUrl}; ${sharedAttributes}`,
  ];
}

export function readProfileFromDocumentCookie() {
  if (typeof document === 'undefined') {
    return null;
  }

  return parseProfileCookieString(document.cookie);
}

export function writeProfileToDocumentCookie(profile) {
  if (typeof document === 'undefined') {
    return;
  }

  buildProfileCookieAssignments(profile).forEach((cookie) => {
    document.cookie = cookie;
  });
}

export function clearProfileDocumentCookie() {
  if (typeof document === 'undefined') {
    return;
  }

  document.cookie = `${PROFILE_COOKIE_NAMES.displayName}=; Max-Age=0; Path=/; SameSite=Lax`;
  document.cookie = `${PROFILE_COOKIE_NAMES.email}=; Max-Age=0; Path=/; SameSite=Lax`;
  document.cookie = `${PROFILE_COOKIE_NAMES.avatarUrl}=; Max-Age=0; Path=/; SameSite=Lax`;
}
