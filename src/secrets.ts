import "server-only";

import { createNextSecrets } from "@gadicc/loom/next/secrets";

import loomManifest from "../loom.json";

const config = loomManifest.features.secrets.config;

// loom.json records the fingerprint of every key a deployed environment is
// expected to hold, so a key that differs from the saved copy is refused.
export const secrets = createNextSecrets({
  expectedKeys: config.keys,
  variables: config.env,
});

// Declare one purpose per kind of secret, beside the code that uses it:
//
//   export const thingSecret = secrets.purpose("area.thing");
//
// A purpose name and its binding are permanent: a value sealed under them can
// never be opened under different ones.
