/**
 * Returns a safe representation of a user for a viewer.
 * If the user is a verified public figure and has not revealed to the viewer, return blurred/masked.
 */

const BLURRED_PLACEHOLDER = null; // Frontend will show blurred overlay
const MASKED_DISPLAY_NAME = 'Verified Public Figure';

export function maskUserForViewer<T extends { id: string; name: string; username: string; profilePicture?: string | null; publicFigureVerified?: boolean; revealToUserIds?: string[] }>(
  user: T,
  viewerId: string | null
): T & { blurred?: boolean; displayName?: string; goldStar?: boolean } {
  if (!user.publicFigureVerified) {
    return { ...user, goldStar: false };
  }
  const revealed = viewerId && Array.isArray(user.revealToUserIds) && user.revealToUserIds.includes(viewerId);
  if (revealed) {
    return { ...user, blurred: false, displayName: user.name, goldStar: true };
  }
  return {
    ...user,
    name: MASKED_DISPLAY_NAME,
    username: '', // or masked
    profilePicture: BLURRED_PLACEHOLDER,
    blurred: true,
    displayName: MASKED_DISPLAY_NAME,
    goldStar: true,
  };
}
