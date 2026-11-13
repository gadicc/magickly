import { describe, expect, it } from "vitest";
import { dayOf, dayRulers } from "./planetDays.ts";

describe("dayOf", () => {
  it("names the day each of the seven rules, whatever the local zone", () => {
    expect(dayRulers.map(dayOf)).toEqual([
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ]);
  });

  it("gives no day to the others", () => {
    for (const id of ["earth", "uranus", "rahu", "zodiac", ""])
      expect(dayOf(id), id).toBeUndefined();
  });
});
