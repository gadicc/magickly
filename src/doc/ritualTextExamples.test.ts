import { expect, it } from "vitest";
import { prepare } from "./prepare";
import { parseRitualText, printRitualText } from "./ritualText";
import {
  pugRitualStarter,
  ritualTextExamples,
  ritualTextStarter,
} from "./ritualTextExamples";
import { semanticToJrt } from "./semantic";
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
