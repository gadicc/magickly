/**
 * What the Enochian translator can't do, in plain words (plan 077, "If it
 * works"): the page states these beside its figures. This file is the only
 * place they live; plan 077 quotes them word for word, in this order
 * (`limitations.test.ts` keeps the two equal). They are to be settled with
 * the bars for the new text.
 */
export const TRANSLATOR_LIMITATIONS: readonly string[] = [
  "The only English we can check against is Dee's, and the model has memorised it, so on Dee's words it was shown to be no worse than looking words up, not better.",
  "Nothing beyond the Keys can be checked against a known answer. New Enochian is reconstruction from Dee's words and our grammar notes, and has been judged only by other AI models, not by anyone who reads Enochian.",
  "Coined and derived words are marked; a word marked as found in our data is checked against it before it is shown.",
  "The figures come from about 600 rows and 60 sentences, and each has a margin of error, shown beside it.",
  "Meanings and rules come from Dee, Laycock and Leitch, and some from later traditions (Schueler, the Golden Dawn); each is labelled with its source.",
  "The text you enter is sent to an AI provider, and the provider may refuse to translate some passages.",
];
