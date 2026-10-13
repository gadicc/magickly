import "server-only";

/**
 * Temple forum API keys are stored sealed, never in the clear: a database
 * dump or a read-only SQL leak must not hand out administrator keys to other
 * people's forums. Sealing is Loom's (`templeForumApiKey` in src/secrets.ts),
 * under a key kept for stored secrets alone and saved by the operator.
 *
 * This protects against the database being read on its own. It does not
 * protect against code running in the app, or anyone who can deploy to it or
 * read its environment.
 */

/**
 * What a stored key is bound to. A sealed key copied to another temple, or
 * whose stored address or username was edited, does not open, so a database
 * edit alone cannot send it to a host, attribute it to a forum user or use it
 * for a temple it was not sealed for. Two things it does not stop: an older
 * row of the same temple being put back whole, and anyone the database calls
 * a temple administrator changing the username through the form, which seals
 * the key again under the new name.
 *
 * These are the stored values exactly as saved: every reader and the
 * maintenance location must build the binding here, or they would disagree
 * about what opens.
 */
export function forumKeyBinding(row: {
  templeId: string;
  origin: string;
  apiUsername: string;
}) {
  return {
    temple: row.templeId,
    origin: row.origin,
    username: row.apiUsername,
  };
}

/** The last characters, enough for an administrator to recognise which key is saved. */
export function forumKeyHint(apiKey: string) {
  return apiKey.length > 8 ? apiKey.slice(-4) : "";
}
