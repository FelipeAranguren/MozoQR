/** Emails con acceso Super Admin (PLATFORM_ADMIN_EMAILS separados por coma). */
export function getPlatformAdminEmails(): string[] {
  const raw =
    process.env.PLATFORM_ADMIN_EMAILS ||
    'marioealfonzo@gmail.com';
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isPlatformAdminEmail(email: string | null | undefined): boolean {
  const e = String(email || '').trim().toLowerCase();
  if (!e) return false;
  return getPlatformAdminEmails().includes(e);
}
