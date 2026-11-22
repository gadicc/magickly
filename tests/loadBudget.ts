/**
 * Time budgets for tests that each do seconds of work.
 *
 * Vitest's 5 s and Testing Library's 1 s stay the defaults, so a test that
 * slows down still shows. Some tests do real work: PGlite migrations and
 * imports, the whole hint table through the lookup, the hall editor's
 * random edits through Pug, and the dictionary's, the tablet names' and
 * the AI reading's full pages in jsdom. Alone under coverage their slowest
 * took 1–4 s; with two `test:coverage` runs at once (load about 100 on 24
 * cores, 21–22 November 2026) they took 3 to 10 times that, the slowest
 * 15.5 s, and timed out at the defaults though nothing was wrong. Those
 * tests opt into these, the test saying what it measured, or the whole
 * file with `vi.setConfig` where every test in it is of that kind.
 */

/** A test's budget, where the test or its file opts in. */
export const LOADED_TEST_TIMEOUT = 30_000;

/** How long Testing Library's waits keep trying, in a file that opts in. */
export const LOADED_WAIT_TIMEOUT = 10_000;
