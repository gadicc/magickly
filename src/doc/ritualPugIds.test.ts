import { expect, it } from "vitest";
import {
  ritualPugHeaderId,
  ritualPugLineOfId,
  ritualPugNodeIdAtLine,
} from "./ritualPugIds";

const source = [
  "//- magickli-ritual-pug 1",
  "note#Note000000000001",
  "  b#Bold000000000001 Officers",
  "  | text with #[b#Inline0000000001 inline]",
  "Hierophant#Hiero00000000001:",
  "  | Fratres and sorores,",
  "  | assist me.",
  "* Keryx#Keryx00000000001 Opens.",
  'say#Say0000000000001(role="Hiero")',
  '  summary#Summary000000001(summary="x")',
  "    | inside the summary",
  "",
  "  | after a blank line",
].join("\n");
const lines = source.split("\n");
const at = (line: number) => ritualPugNodeIdAtLine((n) => lines[n - 1], line);

it("reads node header IDs but not inline or pipe text", () => {
  expect(ritualPugHeaderId(lines[1])).toBe("Note000000000001");
  expect(ritualPugHeaderId(lines[4])).toBe("Hiero00000000001");
  expect(ritualPugHeaderId(lines[7])).toBe("Keryx00000000001");
  expect(ritualPugHeaderId(lines[3])).toBeNull();
  expect(ritualPugHeaderId(lines[0])).toBeNull();
});

it("finds the node enclosing a line by indentation", () => {
  expect(at(2)).toBe("Note000000000001");
  expect(at(3)).toBe("Bold000000000001");
  expect(at(4)).toBe("Note000000000001");
  expect(at(7)).toBe("Hiero00000000001");
  expect(at(11)).toBe("Summary000000001");
  expect(at(13)).toBe("Say0000000000001");
  expect(at(1)).toBeNull();
});

it("finds the line of a node's header", () => {
  expect(ritualPugLineOfId(source, "Keryx00000000001")).toBe(8);
  expect(ritualPugLineOfId(source, "Inline0000000001")).toBeNull();
  expect(ritualPugLineOfId(source, "missing")).toBeNull();
});
