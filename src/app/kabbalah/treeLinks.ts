import type { SephirahRow, TreeOfLifePathRow } from "magick-data/rows";

/*
 * Where magick.ly's Trees link (plan 080, "The API before publishing"):
 * the Tree draws no links of its own, so each page that links its spheres
 * and paths passes these, as the image API's Tree does, whose source SVG
 * has always carried them.
 */

/** A sphere's page: `/kabbalah/sephirah/<id>`. */
export const sephirahHref = (sephirah: SephirahRow) =>
  `/kabbalah/sephirah/${sephirah.id}`;

/** A path's page: `/kabbalah/path/<id>`. */
export const pathHref = (path: TreeOfLifePathRow) =>
  `/kabbalah/path/${path.id}`;

/** A sphere's grade, on the Grade Tree: `/gd/grade/<id>`. */
export const gradeHref = (sephirah: SephirahRow) =>
  `/gd/grade/${sephirah.gdGradeId}`;
