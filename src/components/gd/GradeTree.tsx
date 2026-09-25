import TreeOfLife from "../kabbalah/TreeOfLife";

/*
 * The Tree with each sephirah numbered and named by its grade and linked to
 * the grade's page, and its paths unlinked.
 *
 * A Server Component, as every page that draws it is (/gd through Tiles,
 * /gd/grades and each grade's page), so the two href functions below are
 * plain functions passed on the server. Nothing here needs the client, and
 * marked "use client" it carried the barrel the Tree reads into those
 * routes' client chunks (plan 036, decision 10).
 */

function sephirahHref(s) {
  return "/gd/grade/" + s.data.gdGradeId;
}

function pathHref() {
  return null;
}

function GradeTree({ ...props }) {
  return (
    <TreeOfLife
      field="gdGrade.id"
      topText="gdGrade.name"
      bottomText="gdGrade.element.symbol,gdGrade.orderId,gdGrade.planet.symbol"
      sephirahHref={sephirahHref}
      pathHref={pathHref}
      {...props}
    />
  );
}

export default GradeTree;
