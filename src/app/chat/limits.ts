/**
 * The daily allowances, apart from `usage.ts` so a page can say what a
 * request will use without bundling the database: chat submissions, and
 * the AI reading of Enochian's units (plan 081, S4), from the same
 * counters.
 */

/** A signed-in reader's allowance a day. */
export const USER_DAILY_CHAT_LIMIT = 100;
/** The allowance every signed-out reader shares a day. */
export const ANONYMOUS_DAILY_CHAT_LIMIT = 500;
