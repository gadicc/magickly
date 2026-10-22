import { expect, it } from "vitest";
import { parseRitualPug, printRitualPug } from "./ritualPug";
import { ritualPugExamples, ritualPugStarter } from "./ritualPugExamples";
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

it("the Pug starter supports visual editing", () => {
  const document = parseRitualPug(ritualPugStarter);
  expect(visualRitualState(document).issue).toBeNull();
});
