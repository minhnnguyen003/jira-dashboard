import { getCookieValueFromString, PROFILE_COOKIE_NAMES, parseProfileCookieString } from '../../../../lib/profile-cookie.js';

export function readProfileFromRequestCookieHeader(cookieHeader) {
  return parseProfileCookieString(cookieHeader || '');
}

export function readProfileEmailFromRequestCookieHeader(cookieHeader) {
  return getCookieValueFromString(cookieHeader || '', PROFILE_COOKIE_NAMES.email);
}

export function buildWorklogAuthorJql(profileOrEmail) {
  const email = typeof profileOrEmail === 'string'
    ? profileOrEmail.trim()
    : profileOrEmail?.email?.trim();

  if (!email) {
    throw new Error('Missing jira_email in profile cookie');
  }

  return `worklogAuthor = "${email.replace(/"/g, '\\"')}"`;
}
