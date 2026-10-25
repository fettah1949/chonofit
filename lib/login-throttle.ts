const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;

const failures = new Map<string, { count: number; since: number }>();

function current(email: string) {
  const row = failures.get(email);
  if (!row) return null;
  if (Date.now() - row.since > WINDOW_MS) {
    failures.delete(email);
    return null;
  }
  return row;
}

export function loginBlocked(email: string) {
  return (current(email)?.count ?? 0) >= MAX_FAILURES;
}

export function loginFailed(email: string) {
  const row = current(email);
  if (!row) {
    failures.set(email, { count: 1, since: Date.now() });
    return;
  }
  row.count += 1;
}

export function loginSucceeded(email: string) {
  failures.delete(email);
}
