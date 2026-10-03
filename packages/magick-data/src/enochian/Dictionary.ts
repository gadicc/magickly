/**
 * The Enochian dictionary: 1,911 words, each with its meanings, its
 * pronunciations and its gematria.
 *
 * It is not a table — it is named in no link, in either direction, though
 * [the integrity check](../integrity.ts) holds every entry to its type — and
 * [the build](../build.ts) declares it `unknown`, as it does every text that
 * is not a table: inferring its type from the JSON would cost TypeScript about
 * 19,300 types (plan 032, decision 1). The cast below states
 * [EnochianDictionary](./dictionaryEntry.ts) instead, so this import costs
 * that `Record` and no more, and the generated declaration names nothing
 * outside `dist/`.
 *
 * It is 243 KB of JSON. `/enochian/dictionary` is the page that wants all of
 * it; `/enochian/keys` resolves the words its keys use on the server and
 * ships those
 * ([keyEntries.ts](../../../../src/app/enochian/keys/keyEntries.ts)).
 */
import dictionary from "../../dist/enochian/dictionary.js";
import type { EnochianDictionary } from "./dictionaryEntry.ts";

export type { EnochianDictionary, EnochianEntry } from "./dictionaryEntry.ts";

export default dictionary as EnochianDictionary;
