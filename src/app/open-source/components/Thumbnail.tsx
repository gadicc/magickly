import Kamea from "magick-components/astrology/Kamea";
import Moon from "magick-components/astrology/Moon";
import PlanetarySpirit from "magick-components/astrology/planetarySpirits";
import Chakras from "magick-components/chakras/Chakras";
import GradeTree from "magick-components/gd/GradeTree";
import Lamen from "magick-components/gd/Lamen";
import FylfotCross from "magick-components/gd/symbols/fylfot-cross";
import type { ComponentType } from "react";
import { inkClass } from "@/drawings/Ink";
import { plateClass } from "@/drawings/plate";
import {
  COMPONENT_EXAMPLES,
  type ExplorerComponent,
} from "@/explorer/components";
import { componentImage } from "@/explorer/images";
import { GD_HALLS } from "@/render/contracts/gdHall";
import { hallFiles } from "@/seo/halls";
import styles from "./components.module.css";

const noLink = () => null;

/**
 * The components drawn live on the index, on the server: none of them
 * loads `nlopt-js` or `astronomy-engine` (the note under plan 080's
 * stages). The Moon is a client component, which brings only `lune`.
 */
// biome-ignore lint/suspicious/noExplicitAny: each takes its first example's props
const LIVE_TILES: Partial<Record<string, ComponentType<any>>> = {
  // A tile is a link, so the Tree's own links would nest in it.
  GradeTree: (props: object) => (
    <GradeTree {...props} sephirahHref={noLink} pathHref={noLink} />
  ),
  Lamen,
  FylfotCross,
  Kamea,
  PlanetarySpirit,
  Chakras,
  Moon,
};

/**
 * A component's tile picture (plan 080, the note under the stages): the
 * image route's drawing where the component has a contract, so the index
 * loads neither the sigil's optimiser nor an ephemeris; the published hall
 * for the halls; Mercury's picture without its dates, which need
 * `astronomy-engine`; and the rest drawn live from their first example.
 */
export default function Thumbnail({
  component,
}: {
  component: ExplorerComponent;
}) {
  const [first] = COMPONENT_EXAMPLES[component.name].examples;
  const props = first.props as Record<string, unknown>;
  const image =
    component.name === "GdHall"
      ? hallFiles(GD_HALLS[0]).small.path
      : componentImage(component.name, props);
  if (image)
    return (
      // biome-ignore lint/performance/noImgElement: the image route's own files, which the optimiser would re-encode
      <img
        src={image}
        alt=""
        loading="lazy"
        // An image cannot be re-inked from outside, so it sits on a card.
        className={`${styles.image} ${plateClass}`}
      />
    );
  if (component.name === "Mercury")
    return (
      <div className={styles.mercury}>
        {/* biome-ignore lint/performance/noImgElement: a small static picture */}
        <img src="/pics/mercury.webp" alt="" width={85} height={85} />
      </div>
    );
  const Live = LIVE_TILES[component.name];
  if (!Live) return null;
  const dark =
    component.dark === undefined
      ? ""
      : component.dark === "plate"
        ? plateClass
        : inkClass(component.dark);
  return (
    <div className={`${styles.live} ${dark}`} aria-hidden>
      <Live {...props} />
    </div>
  );
}
