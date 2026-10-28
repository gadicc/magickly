import { HALL_PRESETS } from "@magick-components/gd/hall/presets";
import { describe, expect, it } from "vitest";
import { updateHallAttrs } from "@/doc/gdHallEditor/hallModel";
import { gdHallSource } from "@/doc/gdHallRows";
import {
  canRedo,
  canUndo,
  entryOfHall,
  entryOfSource,
  type HallHistory,
  type HallHistoryAction,
  hallHistoryReducer,
  initialHistory,
  MAX_HALL_HISTORY,
} from "./hallHistory";

const start = () => entryOfHall(gdHallSource(HALL_PRESETS[0].hall));
/** What the page dispatches once typing rests: the source, read. */
const typed = (source: string): HallHistoryAction => ({
  type: "typed",
  entry: entryOfSource(source),
});
const run = (history: HallHistory, ...actions: HallHistoryAction[]) =>
  actions.reduce(hallHistoryReducer, history);
/** The start's hall with its caption changed, as a visual gesture gives. */
const recaptioned = (history: HallHistory, text: string) => {
  const hall = history.present.hall;
  if (!hall) throw new Error("no hall");
  const caption = hall.children?.find(
    (child) => child.kind === "element" && child.tag === "caption",
  );
  if (caption?.kind !== "element") throw new Error("no caption");
  return updateHallAttrs(hall, caption.id, { text });
};

describe("the hall editor's history", () => {
  it("reads a source as its hall, or as why it holds none", () => {
    const entry = start();
    expect(entryOfSource(entry.source)).toEqual(entry);
    const broken = entryOfSource("gdHall\n  floor\n    altar(x=.5)\n");
    expect(broken.hall).toBeNull();
    expect(broken.diagnostic).toMatchObject({
      line: 3,
      source: "gdHall\n  floor\n    altar(x=.5)\n",
    });
  });

  it("takes one step per visual gesture, undone and redone", () => {
    let history = initialHistory(start());
    expect(canUndo(history)).toBe(false);
    const first = recaptioned(history, "One");
    history = run(history, { type: "visual", hall: first });
    expect(history.present.hall).toBe(first);
    expect(history.present.source).toContain("caption#");
    expect(history.present.source).toContain('text="One"');
    history = run(history, {
      type: "visual",
      hall: recaptioned(history, "Two"),
    });
    expect(history.past).toHaveLength(2);
    history = run(history, { type: "undo" });
    expect(history.present.hall).toBe(first);
    expect(canRedo(history)).toBe(true);
    history = run(history, { type: "redo" });
    expect(history.present.source).toContain('text="Two"');
    // A new step drops what could be redone.
    history = run(
      history,
      { type: "undo" },
      {
        type: "visual",
        hall: recaptioned(history, "Three"),
      },
    );
    expect(canRedo(history)).toBe(false);
    // Nothing to undo or redo past the ends: the same history.
    const fresh = initialHistory(start());
    expect(run(fresh, { type: "undo" })).toEqual(fresh);
    expect(run(fresh, { type: "redo" })).toEqual(fresh);
  });

  it("makes typing one step once it settles", () => {
    const base = initialHistory(start());
    const source = base.present.source;
    let history = run(
      base,
      typed(source.replace("Neophyte", "N")),
      typed(source.replace("Neophyte", "Ne")),
    );
    expect(history.past).toHaveLength(0);
    expect(history.typingFrom).toBe(base.present);
    expect(canUndo(history)).toBe(true);
    history = run(history, { type: "settle" });
    expect(history.past).toEqual([base.present]);
    expect(history.present.source).toContain("Ne Temple");
    // Typed back to where it began: no step.
    const back = run(base, typed(`${source} `), typed(source), {
      type: "settle",
    });
    expect(back.past).toHaveLength(0);
    expect(run(base, typed(source))).toBe(base);
  });

  it("undoes typing that has not settled yet as one step", () => {
    const base = initialHistory(start());
    const unsettled = run(base, typed("gdHall\n  floor\n    altar(x=.5)\n"));
    expect(unsettled.present.hall).toBeNull();
    const undone = run(unsettled, { type: "undo" });
    expect(undone.present).toBe(base.present);
    expect(undone.future[0].hall).toBeNull();
    // A gesture made while typing is unsettled settles it first.
    const gesture = run(
      run(base, typed(base.present.source.replace("Neophyte", "Mine"))),
      { type: "settle" },
    );
    const visual = run(gesture, {
      type: "visual",
      hall: recaptioned(gesture, "After"),
    });
    expect(visual.past).toHaveLength(2);
  });

  it("loads a hall as one step, and keeps at most the cap", () => {
    let history = initialHistory(start());
    const other = entryOfHall(gdHallSource(HALL_PRESETS[1].hall));
    history = run(history, { type: "load", entry: other });
    expect(history.present).toBe(other);
    expect(run(history, { type: "load", entry: other })).toBe(history);
    for (let n = 0; n < MAX_HALL_HISTORY + 20; n++)
      history = run(history, {
        type: "visual",
        hall: recaptioned(history, `Step ${n}`),
      });
    expect(history.past).toHaveLength(MAX_HALL_HISTORY);
  });
});
