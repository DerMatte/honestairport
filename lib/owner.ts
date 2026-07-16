/**
 * The single site owner is identified by OWNER_EMAIL rather than a role
 * column: no bootstrap ordering (works before the owner row exists) and it
 * matches the env-secret pattern used by app/api/revalidate. `emailVerified`
 * is required so nobody can claim the owner address via unverified
 * email+password signup.
 */
export function isOwner(
  user: { email: string; emailVerified: boolean } | null | undefined,
): boolean {
  const owner = process.env.OWNER_EMAIL;

  return Boolean(
    owner &&
      user &&
      user.emailVerified &&
      user.email.toLowerCase() === owner.toLowerCase(),
  );
}
