import { pathToFileURL } from "node:url";

/**
 * A package's flags for `npm-publish-decision.mjs`, from publish.yml's
 * `DECISION_FLAGS`: a JSON object from each package's name to its flags
 * (plan 080, stage G), such as
 *
 *   {"magick-data": "--expect-exists", "magick-components": ""}
 *
 * A package without a key, or flags that are not a string, throw: a
 * package left out must fail its decision, not skip with no flags.
 *
 * @param {string | undefined} json
 * @param {string} name
 * @returns {string}
 */
export function decisionFlags(json, name) {
  if (!json) throw new Error("DECISION_FLAGS is not set");
  const flags = JSON.parse(json)[name];
  if (typeof flags !== "string")
    throw new Error(`DECISION_FLAGS has no flags for ${name}`);
  return flags;
}

/**
 * The command line: prints the flags of the package named by the first
 * argument, from the environment's `DECISION_FLAGS`; exits 1, saying why,
 * when it has none.
 */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  try {
    console.log(decisionFlags(process.env.DECISION_FLAGS, process.argv[2]));
  } catch (e) {
    console.error(`fail: ${e.message}`);
    process.exitCode = 1;
  }
