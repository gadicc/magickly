import { expect, it } from "vitest";
import { prepare } from "./prepare";
import { parseRitualPug, printRitualPug } from "./ritualPug";
import { parseRitualText, printRitualText } from "./ritualText";
import {
  pugRitualStarter,
  ritualPugExamples,
  ritualPugStarter,
  ritualTextExamples,
  ritualTextStarter,
} from "./ritualTextExamples";
import { semanticToJrt } from "./semantic";

it("keeps the Pug starter and all guide examples executable and exact", () => {
  for (const source of [
    ritualPugStarter,
    ...Object.values(ritualPugExamples),
  ]) {
    const document = parseRitualPug(source);
    expect(parseRitualPug(printRitualPug(document))).toEqual(document);
  }
});

import { visualRitualState } from "./tiptapRitual";

it("the two starter formats render the same ritual and support visual editing", () => {
  const document = parseRitualText(ritualTextStarter);
  expect(semanticToJrt(document)).toEqual(prepare(pugRitualStarter));
  expect(visualRitualState(document).issue).toBeNull();
});

for (const [name, source] of Object.entries(ritualTextExamples)) {
  it(`the guide's ${name} example parses and round-trips without content loss`, () => {
    const document = parseRitualText(source);
    expect(parseRitualText(printRitualText(document))).toEqual(document);
  });
}
