function pad(n) {
  return String(n).padStart(2, '0');
}

function jiraDate(year, month, day, time) {
  return `${year}-${pad(month)}-${pad(day)} ${time}`;
}

/**
 * Build JQL for personal statistics query.
 * @param {string} assigneeEmail
 * @param {number} year
 * @param {number} month  1-based (1 = January)
 * @returns {string}
 */
export function buildPersonalJql(assigneeEmail, year, month) {
  const lastDay = new Date(year, month, 0).getDate();
  const startOfMonth = jiraDate(year, month, 1, '00:00');
  const endOfMonth = jiraDate(year, month, lastDay, '23:59');

  return (
    `assignee = "${assigneeEmail}"\n` +
    `AND (\n` +
    `  (labels NOT IN (hashsubtask) OR labels IS EMPTY)\n` +
    `  AND originalEstimate IS NOT EMPTY\n` +
    `)\n` +
    `AND (\n` +
    `  (\n` +
    `    "Start Date (Time)" >= "${startOfMonth}"\n` +
    `    AND "Due Date (Time)" <= "${endOfMonth}"\n` +
    `  )\n` +
    `  OR (\n` +
    `    "Start Date (Time)" IS EMPTY\n` +
    `    OR "Due Date (Time)" IS EMPTY\n` +
    `  )\n` +
    `)\n` +
    `ORDER BY updated DESC`
  );
}
