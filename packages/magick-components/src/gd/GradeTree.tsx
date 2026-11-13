import TreeOfLife, {
  type TreeOfLifeProps,
  type TreeSephirah,
} from "../kabbalah/TreeOfLife.tsx";

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

function sephirahHref(s: TreeSephirah) {
  return "/gd/grade/" + s.data.gdGradeId;
}

function pathHref() {
  return null;
}

/**
 * The Tree of Life as the map of the Golden Dawn's grades: each sphere
 * labelled with its grade's number and name, with the grade's element,
 * order and planet below, and linked to the grade's page; the paths are
 * not linked. Any of `TreeOfLife`'s props override these.
 */
function GradeTree({ ...props }: TreeOfLifeProps) {
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
