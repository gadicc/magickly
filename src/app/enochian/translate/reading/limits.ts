/**
 * How long a reading's model calls may take, together (seconds): the
 * route's `maxDuration`, which a test holds equal. Here so the card can
 * set its own deadline without bundling the route.
 */
export const READING_MAX_DURATION = 300;

/**
 * How long the card waits for a reading's last line before taking it as
 * lost (ms): the route's limit and a little more, since a function past
 * its limit is stopped and its answer can then end without a word.
 */
export const READING_DEADLINE_MS = (READING_MAX_DURATION + 15) * 1000;
