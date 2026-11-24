import "server-only";
import { ipAddress } from "@vercel/functions";
import dictionary from "magick-data/enochian/dictionary";
import keys from "magick-data/enochian/keys";
import { after } from "next/server";
import { sqlAuthOptions } from "@/auth/runtime";
import { getCurrentSqlUserId } from "@/auth/session";
import { db } from "@/db/neonFull";
import { clientSubject } from "@/limits/client";
import { READING_CLIENT } from "@/limits/policies";
import { buildKeysTable } from "../keysTable.ts";
import { createTranslator, type Translator } from "../lookup.ts";
import { GRAMMAR } from "./grammar.generated.ts";
import { gatewayReadingModel } from "./model.ts";
import { rowsFromKeys } from "./prompt.ts";
import { buildReadingPrompt, type ReadingPrompt } from "./request.ts";
import type { ReadingDependencies } from "./respond.ts";

/**
 * The reading route's real dependencies: the lookup and the prompt built
 * once an instance from the data the bundle carries (the grammar notes
 * from their generated module, never read from disk), the transactional
 * database, the session as chat reads it, the client's bucket keyed by a
 * day's key derived from the auth secret (no new deployment variable), the
 * gateway, and `after` to keep the function alive for its calls.
 */

let translator: Translator | undefined;
let prompt: ReadingPrompt | undefined;

export const readingDependencies: ReadingDependencies = {
  db,
  translator: () => {
    translator ??= createTranslator(buildKeysTable(keys), dictionary);
    return translator;
  },
  prompt: () => {
    prompt ??= buildReadingPrompt({
      dictionary,
      rows: rowsFromKeys(keys),
      grammar: GRAMMAR,
    });
    return prompt;
  },
  userId: getCurrentSqlUserId,
  clientSubject: (request, day) =>
    clientSubject(
      sqlAuthOptions.secret,
      READING_CLIENT,
      ipAddress(request),
      day,
    ),
  model: gatewayReadingModel,
  waitUntil: (work) => after(() => work),
};
