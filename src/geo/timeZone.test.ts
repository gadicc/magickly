import { describe, expect, it, vi } from "vitest";
import { clocksDiffer, timeZoneNote, utcOffsetMinutes } from "./timeZone";

const winter = new Date("2026-01-15T12:00:00Z");
const summer = new Date("2026-07-15T12:00:00Z");

describe("utcOffsetMinutes", () => {
  it("gives the offset east of UTC, with daylight saving", () => {
    expect(utcOffsetMinutes("Europe/London", winter)).toBe(0);
    expect(utcOffsetMinutes("Europe/London", summer)).toBe(60);
    expect(utcOffsetMinutes("America/New_York", winter)).toBe(-300);
    expect(utcOffsetMinutes("Asia/Kolkata", winter)).toBe(330);
  });
});

describe("clocksDiffer", () => {
  it("compares offsets, not names", () => {
    // GeoNames says Asia/Kolkata; V8 resolves the device's as Asia/Calcutta.
    expect(
      clocksDiffer("Asia/Kolkata", "Asia/Calcutta", [winter, summer]),
    ).toBe(false);
    expect(clocksDiffer("Europe/Kyiv", "Europe/Kiev", [winter, summer])).toBe(
      false,
    );
  });

  it("finds a difference at any of the times", () => {
    // Lisbon and London agree all year; Reykjavík only in winter.
    expect(
      clocksDiffer("Europe/Lisbon", "Europe/London", [winter, summer]),
    ).toBe(false);
    expect(clocksDiffer("Atlantic/Reykjavik", "Europe/London", [winter])).toBe(
      false,
    );
    expect(
      clocksDiffer("Atlantic/Reykjavik", "Europe/London", [winter, summer]),
    ).toBe(true);
  });

  it("says nothing for a zone the runtime doesn't know", () => {
    expect(clocksDiffer("Mars/Olympus_Mons", "Europe/London", [winter])).toBe(
      false,
    );
  });
});

describe("timeZoneNote", () => {
  const times = [winter, summer];

  it("names the device's zone when the place's clock differs", () => {
    expect(
      timeZoneNote(
        { source: "chosen", timezone: "Asia/Tokyo" },
        times,
        "Europe/London",
      ),
    ).toBe("Times are in your device's time zone (Europe/London).");
  });

  it("has no note when the clocks agree under different names", () => {
    expect(
      timeZoneNote(
        { source: "ip", timezone: "Asia/Kolkata" },
        times,
        "Asia/Calcutta",
      ),
    ).toBeNull();
  });

  it("has no note for the device's own position or a place without a zone", () => {
    expect(
      timeZoneNote(
        { source: "device", timezone: "Asia/Tokyo" },
        times,
        "Europe/London",
      ),
    ).toBeNull();
    expect(timeZoneNote({ source: "ip" }, times, "Europe/London")).toBeNull();
  });

  it("has no note when the device has no zone", () => {
    const real = Intl.DateTimeFormat.prototype.resolvedOptions;
    vi.spyOn(
      Intl.DateTimeFormat.prototype,
      "resolvedOptions",
    ).mockImplementation(function (this: Intl.DateTimeFormat) {
      return { ...real.call(this), timeZone: "" };
    });
    expect(
      timeZoneNote({ source: "chosen", timezone: "Asia/Tokyo" }, times),
    ).toBeNull();
    vi.restoreAllMocks();
  });
});
