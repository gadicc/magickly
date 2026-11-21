/**
 * The generator's placement, off the main thread (plan 093, K3): a word
 * placement cannot clear costs about 4 s of synchronous work, which would
 * freeze typing. Each message is one text to trace; the figure goes back
 * with the message's id. `useKameaSigil` ends a worker that is still busy
 * when newer input arrives, rather than queue behind it.
 */
import { kameaSigil } from "magick-components/astrology/KameaSigil";
import type { KameaSigilRequest, KameaSigilResponse } from "./useKameaSigil";

/** The worker's own scope, as much of it as is used (no webworker lib). */
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<KameaSigilRequest>) => void) | null;
  postMessage(message: KameaSigilResponse): void;
};

scope.onmessage = (event) => {
  const { id, planet, text, finals } = event.data;
  let response: KameaSigilResponse;
  try {
    response = { id, sigil: kameaSigil(planet, text, { finals }) };
  } catch (error) {
    response = { id, error: String(error) };
  }
  scope.postMessage(response);
};
