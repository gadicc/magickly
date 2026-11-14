import { TreeOfLife, type TreeOfLifeProps } from "../kabbalah/TreeOfLife.tsx";

/*
 * The Tree with each sephirah numbered and named by its grade.
 *
 * A Server Component, as every page that draws it is (/gd through Tiles,
 * /gd/grades and each grade's page). Nothing here needs the client, and
 * marked "use client" it carried the barrel the Tree reads into those
 * routes' client chunks (plan 036, decision 10).
 */

/**
 * The Tree of Life as the map of the Golden Dawn's grades: each sphere
 * labelled with its grade's number and name, with the grade's element,
 * order and planet below. Like the Tree, it links nothing unless given
 * `sephirahHref` or `pathHref` (a sphere's row names its grade as
 * `gdGradeId`). Any of `TreeOfLife`'s props override these.
 */
export function GradeTree({ ...props }: TreeOfLifeProps) {
  return (
    <TreeOfLife
      field="gdGrade.id"
      topText="gdGrade.name"
      bottomText="gdGrade.element.symbol,gdGrade.orderId,gdGrade.planet.symbol"
      {...props}
    />
  );
}

export default GradeTree;
