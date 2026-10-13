import { defineSecretLocations } from "@gadicc/loom/secrets/maintenance";

// Every column that holds a sealed string must be declared here. The
// maintenance operations (report, verify, reseal) only reach declared
// locations, so an undeclared column is never re-encrypted and keeps its old
// key in use without anyone noticing.
export const secretLocations = defineSecretLocations([]);
