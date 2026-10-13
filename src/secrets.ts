import "server-only";

import { createNextSecrets } from "@gadicc/loom/next/secrets";

import loomManifest from "../loom.json";

const config = loomManifest.features.secrets.config;

// loom.json records the fingerprint of every key a deployed environment is
// expected to hold, so a key that differs from the saved copy is refused.
export const secrets = createNextSecrets({
  expectedKeys: config.keys,
  variables: config.env,
  // A value that stops opening may have been altered, or this server's keys
  // may be wrong; either way someone should be able to find out. The event
  // holds the purpose, key version and reason, never a value or its binding.
  onFailure: ({ purpose, keyId, reason }) =>
    console.warn(
      "A stored secret could not be opened:",
      purpose,
      keyId,
      reason,
    ),
});

// One purpose per kind of secret. A purpose name and its binding are
// permanent: a value sealed under them can never be opened under different
// ones, so changing which fields a purpose is bound to means a new name.

/**
 * A temple's Discourse API key (`temple_forums.api_key_encrypted`), bound to
 * the temple, the forum address and the API username by `forumKeyBinding`.
 * The length limit is the column's.
 */
export const templeForumApiKey = secrets.purpose("temple-forum.api-key", {
  maxLength: 2048,
});
