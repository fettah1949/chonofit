const TEMPORARY_PASSWORDS = ["Admin1234!", "Reception1234!"];

export function isTemporaryPassword(password: string) {
  return TEMPORARY_PASSWORDS.includes(password);
}
