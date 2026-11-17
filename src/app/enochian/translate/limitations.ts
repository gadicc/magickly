/**
 * What the Enochian translator can't do, in plain words. This file is the
 * only place the lists live; the plans quote them word for word, and
 * `limitations.test.ts` keeps each plan and its list equal.
 */

/**
 * How a translation is made: by lookup (stage 1), or by the AI reading of
 * Enochian into English (stage 2), with its own list (that the text goes
 * to OpenAI through Vercel).
 */
export type TranslationMode = "lookup" | "ai";

/**
 * The translator's limitations, per mode of translation (plan 081,
 * decision 20). The lookup's six hold for both directions, and the page
 * shows them once, whichever direction it reads in; the AI reading's five
 * (S8) are shown with its card. Plan 081 quotes both lists word for word,
 * in this order.
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
    "The lookup runs in your browser, and your text stays in the page's address after the # sign, which isn't sent anywhere. Only an AI reading sends it, when you ask for one.",
  ],
  ai: [
    "It is made by a language model (GPT-6.1 Terra) given our dictionary, Dee's Keys and our grammar notes; it can be wrong, and no one who reads Enochian has reviewed it.",
    "Each word it reads is checked against our data and marked as confirmed, not confirmed, or the model's guess; its sentence is not checked.",
    "Your text goes to OpenAI through Vercel to make the reading; Vercel keeps no copy, and OpenAI handles it under a zero-retention agreement. Our server keeps the text and its reading for a day, so anyone who reads the same text again gets it free, and deletes them within two days.",
    "The provider may refuse some passages.",
    "Each reading uses your daily allowance: one, plus one per 100 words.",
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
