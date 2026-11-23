/**
 * Where the reader is in a ritual (plan 089, decision 2): the section for
 * the Contents rail and the count to the reader's next line. Pure, over
 * positions the reader measures with `getBoundingClientRect`, so the same
 * numbers hold whatever the layout's offset parents are.
 */

/** A drawn task, in document order: its top in viewport pixels. */
export interface TaskPosition {
  top: number;
  /** One of the reader's own tasks (`myRole`). */
  mine: boolean;
}

/** The reader's next own task, and how many tasks come before it. */
export interface NextLine {
  /** The next own task's index in the positions given. */
  index: number;
  /**
   * The tasks, not notes, titles or halls, that start below the
   * viewport's bottom edge and before the reader's next own task: 0 when
   * the first task off the screen is the reader's own.
   */
  count: number;
}

/**
 * The reader's next line: the first own task whose top is below `bottom`,
 * the viewport's bottom edge, as the floating button has always aimed.
 * `null` once there is none, after the reader's last line.
 */
export function nextLine(
  tasks: readonly TaskPosition[],
  bottom: number,
): NextLine | null {
  let count = 0;
  for (let index = 0; index < tasks.length; index++) {
    const task = tasks[index];
    if (task.top <= bottom) continue;
    if (task.mine) return { index, count };
    count++;
  }
  return null;
}

/**
 * The current section: the index of the last title whose top is at or
 * above `line` (just below the app bar), by position among the titles, as
 * titles' texts and anchors may repeat. Above the first title the reader is
 * in the first section, so it is 0 there; -1 only when there are no titles.
 */
export function currentSection(
  titleTops: readonly number[],
  line: number,
): number {
  if (titleTops.length === 0) return -1;
  let current = 0;
  for (let index = 1; index < titleTops.length; index++) {
    if (titleTops[index] > line) break;
    current = index;
  }
  return current;
}

/** The space above the visible bottom that a jump leaves below the line. */
export const JUMP_CLEARANCE = 88;
/** The space a jump leaves at least above a tall line's start. */
const JUMP_HEADROOM = 24;

/**
 * How far to scroll down to bring the reader's next line into view, its
 * cue above it: the line's end `JUMP_CLEARANCE` above the visible bottom,
 * clear of the floating button (16 px from the edge, 56 px high) and a
 * phone's toolbar, not on the edge itself. A line too tall for that keeps
 * its start in view instead, just below the visible top (the app bar's
 * edge), where its first words are. Positions are viewport pixels.
 */
export function jumpDistance(
  line: { top: number; bottom: number },
  visible: { top: number; bottom: number },
): number {
  return Math.min(
    line.bottom - (visible.bottom - JUMP_CLEARANCE),
    line.top - (visible.top + JUMP_HEADROOM),
  );
}
