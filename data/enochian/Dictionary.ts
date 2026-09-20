/**
 * The Enochian dictionary: 1,903 words, each with its meanings, its
 * pronunciations and its gematria.
 *
 * It is not a table — it is named in no link, in either direction, and
 * nothing checks it against a schema — and it is the one source
 * [the build](../build.mts) emits as a module rather than as JSON, because a
 * JSON import of it costs TypeScript about 19,300 types (plan 032,
 * decision 1). The emitted declaration names
 * [EnochianDictionary](./dictionaryEntry.ts) and nothing else, so this import
 * costs that `Record` and no more.
 *
 * It is 243 KB of JSON. `/enochian/dictionary` is the page that wants all of
 * it; `/enochian/keys` resolves the words its keys use on the server and
 * ships those ([keyEntries.ts](../../src/app/enochian/keys/keyEntries.ts)).
 */
import dictionary from "../dist/enochian/dictionary.mjs";

export type { EnochianDictionary, EnochianEntry } from "./dictionaryEntry";

export default dictionary;
