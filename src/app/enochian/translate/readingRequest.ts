import type { CheckedReading } from "./reading/check.ts";
import type { ReadingEvent } from "./reading/respond.ts";

/** The AI reading's route (plan 081, S5). */
export const READING_URL = "/api/enochian/read";

/**
 * Asks for the AI reading of `text` (plan 081, S5) and hands each line of
 * the answer to `onEvent` as it lands, so the card can show a part before
 * the next is read. The text travels in the JSON body, never the URL; the
 * page's address keeps it after the # sign, as the lookup leaves it.
 * `again` is "Read again": a new reading at the reader's cost.
 *
 * Resolves when the answer ends; throws when it can't be read (the network
 * failed, or an answer that isn't the route's), and with `signal`'s reason
 * when the reader leaves. The route's calls go on regardless, and a part
 * they read is stored.
 */
export async function requestReading(
  text: string,
  options: {
    again?: boolean;
    signal?: AbortSignal;
    onEvent: (event: ReadingEvent) => void;
  },
): Promise<void> {
  const response = await fetch(READING_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, again: options.again === true }),
    credentials: "same-origin",
    cache: "no-store",
    signal: options.signal,
  });
  if (!/ndjson/i.test(response.headers.get("content-type") ?? ""))
    throw new Error(`${READING_URL}: ${response.status}`);
  // A line that isn't JSON (one cut short) or isn't an event the card
  // knows is passed over: an answer with no last line then ends as lost.
  const take = (line: string) => {
    if (!line.trim()) return;
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      return;
    }
    const event = readingEvent(value);
    if (event) options.onEvent(event);
  };
  if (!response.body) {
    for (const line of (await response.text()).split("\n")) take(line);
    return;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let rest = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    rest += decoder.decode(value, { stream: true });
    const lines = rest.split("\n");
    rest = lines.pop() ?? "";
    for (const line of lines) take(line);
  }
  take(rest + decoder.decode());
}

/** The most parts an answer may name: the route reads one or two. */
const MAX_PARTS = 8;

type Data = Record<string, unknown>;

const isObject = (value: unknown): value is Data =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === "string";
const isCount = (value: unknown): value is number =>
  Number.isInteger(value) && (value as number) >= 0;
const isTime = (value: unknown) =>
  isString(value) && !Number.isNaN(Date.parse(value));

const WORD_STATES = new Set(["confirmed", "unconfirmed", "guess", "none"]);

/** A source the card can name: a headword, or a Key row. */
const isSource = (value: unknown) =>
  isObject(value) &&
  (value.kind === "headword"
    ? isString(value.headword)
    : value.kind === "row" &&
      isCount(value.key) &&
      isCount(value.row) &&
      isString(value.word) &&
      (value.aethyr === undefined || isCount(value.aethyr)));

/** A checked reading the card can show (`CheckedReading`). */
function isReading(value: unknown): value is CheckedReading {
  if (!isObject(value) || !Array.isArray(value.words)) return false;
  const { sentence } = value;
  const words = value.words.every(
    (word) =>
      isObject(word) &&
      isString(word.word) &&
      WORD_STATES.has(word.state as string) &&
      (word.english === undefined || isString(word.english)) &&
      Array.isArray(word.sources) &&
      word.sources.every(isSource),
  );
  return (
    words &&
    isObject(sentence) &&
    (sentence.shown === true
      ? isString(sentence.text)
      : sentence.shown === false && isString(sentence.withheld))
  );
}

/**
 * One line of the route's answer, checked before the card uses it: an
 * event of a type the card knows, with the fields it reads in range, or
 * undefined. A part outside its answer's parts, a reading with words the
 * card can't show, or a refusal without its counts is never shown.
 */
export function readingEvent(value: unknown): ReadingEvent | undefined {
  if (!isObject(value)) return undefined;
  switch (value.type) {
    case "part": {
      const { part, parts } = value;
      if (!isCount(parts) || parts < 1 || parts > MAX_PARTS) return undefined;
      if (!isCount(part) || part < 1 || part > parts) return undefined;
      if (value.status === "read")
        return isReading(value.reading) &&
          (value.from === "store" || value.from === "model")
          ? (value as ReadingEvent)
          : undefined;
      return value.status === "failed" && isString(value.state)
        ? (value as ReadingEvent)
        : undefined;
    }
    case "done":
      return ["read", "partial", "failed"].includes(value.state as string) &&
        isCount(value.units)
        ? (value as ReadingEvent)
        : undefined;
    case "refused":
      if (!isString(value.state)) return undefined;
      if (value.state === "ceiling" && !isTime(value.resetAt)) return undefined;
      if (
        value.state === "allowance" &&
        !(
          isCount(value.units) &&
          isCount(value.left) &&
          isCount(value.limit) &&
          isTime(value.resetAt) &&
          ["user", "anonymous", "client"].includes(value.scope as string)
        )
      )
        return undefined;
      return value as ReadingEvent;
    default:
      return undefined;
  }
}
