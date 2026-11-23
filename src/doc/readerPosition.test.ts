import { describe, expect, it } from "vitest";
import {
  currentSection,
  JUMP_CLEARANCE,
  jumpDistance,
  nextLine,
} from "./readerPosition";

const task = (top: number, mine = false) => ({ top, mine });

describe("the reader's next line", () => {
  it("counts the tasks below the screen before the reader's own", () => {
    expect(
      nextLine(
        [task(100, true), task(700), task(900), task(950), task(1200, true)],
        800,
      ),
    ).toEqual({ index: 4, count: 2 });
  });

  it("is 0 when the first task off the screen is the reader's", () => {
    expect(nextLine([task(100), task(900, true), task(1000)], 800)).toEqual({
      index: 1,
      count: 0,
    });
  });

  it("passes over the reader's own tasks still on the screen", () => {
    // One starting exactly at the bottom edge is on the screen.
    expect(
      nextLine([task(300, true), task(800, true), task(801, true)], 800),
    ).toEqual({ index: 2, count: 0 });
  });

  it("is null after the reader's last line", () => {
    expect(nextLine([task(100, true), task(900), task(1000)], 800)).toBeNull();
    expect(nextLine([], 800)).toBeNull();
  });
});

describe("the current section", () => {
  it("is the last title at or above the line", () => {
    expect(currentSection([-500, -20, 80, 600], 80)).toBe(2);
    expect(currentSection([-500, -20, 81, 600], 80)).toBe(1);
  });

  it("is the first title above it: the reader is in the first section", () => {
    expect(currentSection([200, 900], 80)).toBe(0);
  });

  it("is -1 without titles", () => {
    expect(currentSection([], 80)).toBe(-1);
  });
});

describe("the jump to the reader's next line", () => {
  const visible = { top: 56, bottom: 800 };

  it("brings the line's end above the floating button, not to the edge", () => {
    const line = { top: 1000, bottom: 1100 };
    const distance = jumpDistance(line, visible);
    expect(line.bottom - distance).toBe(800 - JUMP_CLEARANCE);
  });

  it("keeps the start in view in an area too short for the clearance", () => {
    const line = { top: 300, bottom: 320 };
    const short = { top: 200, bottom: 280 };
    expect(line.top - jumpDistance(line, short)).toBe(200 + 24);
  });

  it("keeps a tall line's start in view, below the app bar", () => {
    const line = { top: 1000, bottom: 2000 };
    expect(line.top - jumpDistance(line, visible)).toBe(56 + 24);
  });
});
