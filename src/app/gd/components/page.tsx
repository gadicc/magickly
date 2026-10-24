import Lamen from "@magick-components/gd/Lamen";
import { Fragment } from "react";
import { privateMetadata } from "@/seo/metadata";

export const metadata = privateMetadata("Officer Lamens");

export default function GDComponentTest() {
  return [
    "imperator",
    "praemonstrator",
    "cancellarius",
    "hierophant",
    "pastHierophant",
    "hegemon",
    "hiereus",
    "dadouchos",
    "stolistes",
    "keryx",
    "sentinel",
    "chiefAdept",
    "secondAdept",
    "thirdAdept",
  ].map((officer) => (
    <Fragment key={officer}>
      <Lamen officer={officer} />
      <br />
    </Fragment>
  ));
}
