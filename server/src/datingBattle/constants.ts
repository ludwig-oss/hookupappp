/** Free rounds before the €5 pack. Each started battle consumes one round. */
export const FREE_ROUNDS = 5;
export const PACK_ROUNDS = 5;
export const PACK_PRICE_EUR = 5;

/** Wingman owns the first 5:00. Eject opens only after that clock hits zero. */
export const WINGMAN_MS = 5 * 60 * 1000;
/** Decision beat after the 5:00 so the blue/red eject button is actually reachable. */
export const EJECT_GRACE_MS = 30 * 1000;

export const REJECTION_WINDOW_MS = 30 * 60 * 1000;
export const REJECTION_LIMIT = 3;

export const MIN_DISTANCE_KM = 1;
export const MAX_DISTANCE_KM = 100;
export const DEFAULT_DISTANCE_KM = 40;

export const MATCH_OPENER =
  "You made it through the dating battle without an ejection. You're in Communications — say the thing you didn't get to say.";
