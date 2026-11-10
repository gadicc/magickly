const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(zone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(zone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    formatters.set(zone, formatter);
  }
  return formatter;
}

/**
 * The zone's offset from UTC at `date`, in minutes east (London in summer
 * 60, New York in winter -300). Throws a RangeError for a zone the runtime
 * does not know.
 */
export function utcOffsetMinutes(zone: string, date: Date): number {
  const parts: Record<string, number> = {};
  for (const part of formatterFor(zone).formatToParts(date)) {
    if (part.type !== "literal") parts[part.type] = Number(part.value);
  }
  const wall = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  const instant = Math.floor(date.getTime() / 1000) * 1000;
  return Math.round((wall - instant) / 60_000);
}

/**
 * The device's IANA time zone, or undefined where the runtime has none or
 * names one it can't then use.
 */
export function deviceTimeZone(): string | undefined {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!zone) return undefined;
    formatterFor(zone);
    return zone;
  } catch {
    return undefined;
  }
}

/**
 * The note under a place whose clock differs from the device's at any of
 * `times`, the times the page shows, which stay on the device's clock (plan
 * 072, decision 2): "Times are in your device's time zone (Europe/London)."
 * Null when they agree, when either zone is unknown, and for the device's
 * own position, which has no zone of its own and is where the device is.
 */
export function timeZoneNote(
  place: { source: string; timezone?: string },
  times: readonly Date[],
  deviceZone: string | undefined = deviceTimeZone(),
): string | null {
  if (place.source === "device" || !place.timezone || !deviceZone) {
    return null;
  }
  return clocksDiffer(place.timezone, deviceZone, times)
    ? `Times are in your device's time zone (${deviceZone}).`
    : null;
}

/**
 * Whether a clock in `zone` would read differently from one in `deviceZone`
 * at any of `times`. Compares UTC offsets, not names, since sources name the
 * same zone differently (GeoNames' Asia/Kolkata is V8's Asia/Calcutta, and
 * Europe/Kyiv is Europe/Kiev in older data). False when either zone is
 * unknown to the runtime: no note is better than a wrong one.
 */
export function clocksDiffer(
  zone: string,
  deviceZone: string,
  times: readonly Date[],
): boolean {
  try {
    return times.some(
      (time) =>
        utcOffsetMinutes(zone, time) !== utcOffsetMinutes(deviceZone, time),
    );
  } catch {
    return false;
  }
}
