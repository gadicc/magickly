import { expect, it } from "vitest";
import { prepare } from "./prepare";
import { parseRitualPug, printRitualPug } from "./ritualPug";
import {
  pugRitualStarter,
  ritualPugExamples,
  ritualPugStarter,
} from "./ritualPugExamples";
import { semanticToJrt } from "./semantic";
import { visualRitualState } from "./tiptapRitual";

it("keeps the Pug starter and all guide examples executable and exact", () => {
  for (const source of [
    ritualPugStarter,
    ...Object.values(ritualPugExamples),
  ]) {
    const document = parseRitualPug(source);
    expect(parseRitualPug(printRitualPug(document))).toEqual(document);
  }
});

it("the two Pug starters render the same ritual and support visual editing", () => {
  const document = parseRitualPug(ritualPugStarter);
  expect(semanticToJrt(document)).toEqual(prepare(pugRitualStarter));
  expect(visualRitualState(document).issue).toBeNull();
});
