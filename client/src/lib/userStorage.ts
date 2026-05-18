/** Fields safe to keep in localStorage (no secrets, no huge media blobs). */
export function userForStorage(user: Record<string, unknown>): Record<string, unknown> {
  const id = user.id;
  return {
    id,
    email: user.email,
    name: user.name,
    username: user.username,
    profilePicture:
      typeof user.profilePicture === 'string' && user.profilePicture.length < 500_000
        ? user.profilePicture
        : null,
    profileSetupComplete: Boolean(user.profileSetupComplete),
    emailVerified: user.emailVerified !== false,
    improvementCategories: Array.isArray(user.improvementCategories)
      ? user.improvementCategories.filter((c): c is string => typeof c === 'string')
      : [],
    phoneNumber: user.phoneNumber ?? null,
    age: user.age,
    country: user.country,
    city: user.city,
  };
}
