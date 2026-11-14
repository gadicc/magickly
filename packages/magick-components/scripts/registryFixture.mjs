/**
 * What the smoke test does with its registry fixture, the install of the
 * components' tarball alone that takes magick-data from npm (plan 080,
 * stage G review, H1): `"run"` it, `"skip"` it, saying so, or `"fail"`.
 *
 * - npm has the magick-data version the components were built with (the
 *   floor of the packed `^` range): **run**.
 * - It does not, and the smoke keeps no tarball, or keeps one at 0.0.0,
 *   which is never published: **skip**. There is nothing to compare yet.
 * - It does not, and the smoke keeps a tarball past 0.0.0, which a release
 *   publishes: **fail**, since that version could never be installed;
 *   unless `allowUnpublishedData`, which publish.yml's build leg passes
 *   only when the same run publishes magick-data (its publish leg then
 *   waits for that version before publishing the components), and ci.yml
 *   passes always, since its tarball is only dry-run: **skip**.
 *
 * @param {{
 *   version: string,
 *   keepTarball: boolean,
 *   allowUnpublishedData: boolean,
 *   dataPublished: boolean,
 * }} state
 * @returns {"run" | "skip" | "fail"}
 */
export function registryFixture({
  version,
  keepTarball,
  allowUnpublishedData,
  dataPublished,
}) {
  if (dataPublished) return "run";
  if (!keepTarball || version === "0.0.0" || allowUnpublishedData)
    return "skip";
  return "fail";
}
