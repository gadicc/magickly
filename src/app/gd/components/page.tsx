import Lamen from "@magick-components/gd/Lamen";
import { Fragment } from "react";
import { privateMetadata } from "@/seo/metadata";

export const metadata = privateMetadata("Officer Lamens");

/** Every lamen, then the Portal's own Hiereus and Hegemon (plan 061). */
const LAMENS: readonly [officer: string, grade?: string][] = [
  ["imperator"],
  ["praemonstrator"],
  ["cancellarius"],
  ["hierophant"],
  ["pastHierophant"],
  ["hegemon"],
  ["hiereus"],
  ["dadouchos"],
  ["stolistes"],
  ["keryx"],
  ["sentinel"],
  ["chiefAdept"],
  ["secondAdept"],
  ["thirdAdept"],
  ["hiereus", "portal"],
  ["hegemon", "portal"],
];

export default function GDComponentTest() {
  return LAMENS.map(([officer, grade]) => (
    <Fragment key={`${officer}${grade ?? ""}`}>
      <Lamen officer={officer} grade={grade} />
      <br />
    </Fragment>
  ));
}
