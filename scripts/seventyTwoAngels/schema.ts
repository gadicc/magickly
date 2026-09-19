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

const bilingual = z.object({
  en: z.string().min(1),
  fr: z.string().min(1),
});

export const angelExtraction = z.object({
  no: z.number().int().min(1).max(72),

  name: z.object({
    /** As the entry romanises it, with the scan's damage repaired. */
    en: z.string().min(2),
    /** Five Hebrew letters: a triad of the Shem, then יה or אל. */
    he: z.string().min(1),
  }),
  attribute: bilingual,
  /** The nation this genius rules, and that nation's name for God. */
  people: bilingual,
  godName: z.string().min(1),
  psalm: z.object({
    psalm: z.number().int().min(1).max(150),
    verse: z.number().int().min(1),
    /** The Latin incipit as the entry prints it, repaired. */
    la: z.string().min(1),
  }),
  /** What the entry says the genius is invoked for. */
  invokedFor: z.object({ en: z.string().min(1) }),
  /** What it says the genius dominates or influences. */
  governs: z.object({ en: z.string().min(1) }),
  /** The character of a person born under it. */
  bornUnder: z.object({ en: z.string().min(1) }),
  /** What the contrary genius rules. */
  contrary: z.object({ en: z.string().min(1) }),

  /** The whole entry: repaired French, and English translated from it. */
  text: bilingual,

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
    /** The invocation's opening time, in minutes after midnight. */
    invocationFromMinutes: z.number().int(),
  }),

  /** Anything the model could not resolve, in its own words. */
  uncertain: z.array(z.string()),
});

export type AngelExtraction = z.infer<typeof angelExtraction>;
