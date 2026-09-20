/**
 * What one word of the Enochian dictionary holds, written by hand.
 *
 * The dictionary is the one source [the build](../build.mts) does not emit as
 * JSON. As a JSON import it costs TypeScript about 19,300 types — more than
 * every table in `data/` combined, and casting after the import does not
 * avoid it, because the cost is in inferring the literal type of a 1,903-key
 * object (plan 032, decision 1). It is emitted as a module instead, with a
 * generated declaration that says only this, so the whole file costs the
 * `Record` below.
 *
 * It is a type and not a schema: nothing checks the dictionary against it,
 * as [the integrity check](../integrity.ts) checks the tables. The dictionary
 * is not a table — it is in no link, in neither direction — and its entries
 * are transcriptions from several sources rather than rows.
 */

/** One word, as the dictionary files it. */
export interface EnochianEntry {
  /** The word's numerical values; often empty. */
  gematria: number[];
  /** Each attested translation, with the work it is attested in. */
  meanings: {
    meaning: string;
    source: string;
    source2?: string;
    note?: string;
  }[];
  /** Each attested pronunciation; often empty. */
  pronounciations: {
    pronounciation: string;
    source: string;
  }[];
}

/** Every word, by its Latin spelling as the dictionary keys it. */
export type EnochianDictionary = Record<string, EnochianEntry>;
