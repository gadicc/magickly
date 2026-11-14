/**
 * What the Enochian translator can't do, in plain words. This file is the
 * only place the lists live; the plans quote them word for word, and
 * `limitations.test.ts` keeps each plan and its list equal.
 */

/**
 * How a translation is made: by lookup (stage 1). Stage 2's AI reading
 * will be `ai`, with its own list (that the text goes to Anthropic).
 */
export type TranslationMode = "lookup";

/**
 * The translator's limitations, per mode of translation (plan 081,
 * decision 20). The lookup's six hold for both directions, and the page
 * shows them once, whichever direction it reads in. Plan 081 quotes them
 * word for word, in this order.
 */
export const TRANSLATOR_LIMITATIONS: Readonly<
  Record<TranslationMode, readonly string[]>
> = {
  lookup: [
    "This translator looks words up; it doesn't understand sentences. Each word is a form from Dee's Keys or our dictionary, labelled with its source, or a gap. Grammar words follow our notes' rules, and each change is shown.",
    "Where our data has no exact word, you see a gap, with the nearest forms when we have any. It never makes up Enochian.",
    "Word order follows the English, except that possessives follow their noun, as Dee writes them; each change is shown. No one who reads Enochian has checked the results.",
    "Joined words are split by a rule from our notes. Each split is marked, and outside Dee's own text it may be wrong.",
    "Meanings and rules come from Dee, Laycock and Leitch, and some from later traditions (Schueler, the Golden Dawn). Each is labelled with its source.",
    "What you type isn't sent anywhere. The translation runs in your browser.",
  ],
};

/**
 * Plan 077's list, written for an AI translator ("If it works") and kept
 * for that plan's record, which quotes it word for word, in this order.
 * The page shows `TRANSLATOR_LIMITATIONS`.
 */
export const EXPERIMENT_LIMITATIONS: readonly string[] = [
  "The only English we can check against is Dee's, and the model has memorised it, so on Dee's words it was shown to be no worse than looking words up, not better.",
  "Nothing beyond the Keys can be checked against a known answer. New Enochian is reconstruction from Dee's words and our grammar notes, and has been judged only by other AI models, not by anyone who reads Enochian.",
  "Coined and derived words are marked; a word marked as found in our data is checked against it before it is shown.",
  "The figures come from about 600 rows and 60 sentences, and each has a margin of error, shown beside it.",
  "Meanings and rules come from Dee, Laycock and Leitch, and some from later traditions (Schueler, the Golden Dawn); each is labelled with its source.",
  "The text you enter is sent to an AI provider, and the provider may refuse to translate some passages.",
];
