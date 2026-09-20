import { z } from "zod";

/**
 * What one call returns for one genius.
 *
 * Two halves, deliberately. The first is what goes into the data: repaired
 * French, an English translation of that repaired French, and the fields the
 * page shows. The second, `scanned`, is what the page literally prints, so the
 * validator can compare it against Lenain's arithmetic and say where the scan,
 * or Lenain, is wrong. Telling the model the arithmetic and then asking it to
 * report the same numbers back would prove nothing; it is asked for the
 * printed reading instead, contradictions included.
 */

/**
 * An English reading and the French it was read from, for what an entry may
 * simply not say. Requiring a non-empty string here asked the model to invent,
 * and it did: four entries came back with a description of people born under a
 * genius that their entry never mentions.
 *
 * Both halves or neither. Ten entries carried an English reading with an empty
 * French beside it — a claim about the page with nothing of the page behind
 * it — which no schema can forbid but the instructions now ask for.
 */
const saidOrNot = z.object({
  en: z.string(),
  fr: z.string(),
});

export const angelExtraction = z.object({
  no: z.number().int().min(1).max(72),

  name: z.object({
    /** As the entry romanises it, with the scan's damage repaired. */
    en: z.string().min(2),
    /** Five Hebrew letters: a triad of the Shem, then יה or אל. */
    he: z.string().min(1),
  }),
  /** Lenain sets it in the heading, in brackets after the name. */
  attribute: saidOrNot,
  /**
   * The nation this genius rules. A few entries name none, and those are left
   * empty; the twenty-second names one, though the OCR's lost heading once
   * made it look otherwise.
   */
  people: saidOrNot,
  godName: z.string(),
  psalm: z.object({
    /** 0 where the entry cites something other than a psalm, or nothing. */
    psalm: z.number().int().min(0).max(150),
    verse: z.number().int().min(0),
    /** The Latin incipit as the entry prints it, repaired. */
    la: z.string(),
  }),
  /** Each of these is "" where the entry does not say. Never invented. */
  invokedFor: z.object({ en: z.string() }),
  governs: z.object({ en: z.string() }),
  bornUnder: z.object({ en: z.string() }),
  contrary: z.object({ en: z.string() }),

  /**
   * The entry in English, translated from the French it was given. The French
   * is not asked for: it is read off the page and passed in, so there is
   * nothing for a model to reconstruct and nothing to drift.
   *
   * The floor is there because a model asked for a long string under a schema
   * will sometimes fill it with "placeholder" and move on; ten entries did.
   */
  translation: z.string().min(300),

  /**
   * Lenain's own footnotes, in English, one per note he sets. The French is
   * read off the page and passed in; only the translation is asked for, and
   * the marker ties it back to the call in the prose.
   */
  footnotes: z.array(
    z.object({
      marker: z.string(),
      en: z.string().min(1),
    }),
  ),

  scanned: z.object({
    degrees: z.object({
      from: z.number().int(),
      to: z.number().int(),
    }),
    decade: z.number().int(),
    /** The decade's genius, from the sacred calendar. */
    decanGenius: z.string(),
    /** The ruling planet as printed, or "" where the entry omits it. */
    planet: z.string(),
    /** The choir as printed, or "" where the entry declares none. */
    choir: z.string(),
    /** The five presiding days, as printed. */
    presidingDays: z.array(
      z.object({
        month: z.number().int().min(1).max(12),
        day: z.number().int().min(1).max(31),
      }),
    ),
    /**
     * The invocation's opening time exactly as the entry prints it. Asking for
     * minutes after midnight asked the model to do arithmetic, and it mostly
     * reported the minute hand instead; this asks only what it can read.
     */
    invocationFrom: z.object({
      hour: z.number().int().min(0).max(24),
      minute: z.number().int().min(0).max(59),
      /** "matin", "soir", or "" where the entry says neither. */
      partOfDay: z.string(),
    }),
  }),

  /** Anything the model could not resolve, in its own words. */
  uncertain: z.array(z.string()),
});

export type AngelExtraction = z.infer<typeof angelExtraction>;

/**
 * A second, stronger model's verdict on one restored entry. The bulk pass is
 * cheap and reliable; this is what catches the places it was quietly wrong,
 * which the arithmetic cannot reach — a dropped clause, an invented one, a
 * translation that drifts, a field the entry does not actually support.
 */
export const angelReview = z.object({
  no: z.number().int().min(1).max(72),
  /** clean: ship it. minor: small fixes. rework: extract it again. */
  verdict: z.enum(["clean", "minor", "rework"]),
  issues: z.array(
    z.object({
      /** The field at fault, as a path: "text.fr", "psalm.verse", "name.he". */
      field: z.string().min(1),
      severity: z.enum(["minor", "major"]),
      what: z.string().min(1),
      /**
       * A corrected value, or "" where the reviewer is not sure of one.
       * Not optional: OpenAI's structured output requires every property.
       */
      suggested: z.string(),
    }),
  ),
});

export type AngelReview = z.infer<typeof angelReview>;
