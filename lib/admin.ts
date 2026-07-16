export type UserRole = "user" | "admin";

/**
 * Review posting (and other privileged writes) are gated by the DB-backed
 * `user.role` column — set via SQL/ops, never from signup input. Signup stays
 * open for everyone; only `role = 'admin'` may publish reviews for now.
 */
export function isAdmin(
  user: { role?: string | null } | null | undefined,
): boolean {
  return user?.role === "admin";
}
