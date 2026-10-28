import {
  type HallPreset,
  hallPreset,
  hallSourceText,
  hallSourceUrl,
} from "@magick-components/gd/hall/presets";
import Link from "@magick-components/Link";
import {
  EntityFrame,
  EntityTable,
  Lede,
  PrevNext,
  Row,
  Trail,
} from "@/components/entity";
import {
  GD_HALL_LICENCE,
  GD_HALLS,
  type GdHallEntry,
  gdHallShortName,
  gdHallTitle,
} from "@/render/contracts/gdHall";
import { HALL_LEADS } from "@/seo/hallLeads";
import {
  hallAlt,
  hallFiles,
  hallJsonLd,
  hallPath,
  hallStations,
  listed,
} from "@/seo/halls";
import JsonLd from "@/seo/JsonLd";
import { SITE_URL } from "@/seo/site";
import styles from "./hallPage.module.css";

/** "yellow lantern" → "Yellow lantern", for a row's label. */
const capitalised = (name: string) =>
  name.charAt(0).toUpperCase() + name.slice(1);

/**
 * One temple hall's page (plan 062, decision 2): the hall as a real image
 * at its canonical URL, what it shows in our own words, where its layout
 * comes from, and its licence. A Server Component with no client code of
 * its own, synchronous so that `renderToString` can render it in tests.
 */
export default function HallPage({ hall }: { hall: GdHallEntry }) {
  const preset = hallPreset(hall.preset) as HallPreset;
  const files = hallFiles(hall);
  const lead = HALL_LEADS[hall.slug as keyof typeof HALL_LEADS];
  const stations = hallStations(hall);
  const index = GD_HALLS.findIndex((entry) => entry.slug === hall.slug);
  const neighbour = (entry: GdHallEntry | undefined) =>
    entry && { href: hallPath(entry), label: gdHallShortName(entry) };
  const title = gdHallTitle(hall);
  const credit = `${title}, by ${GD_HALL_LICENCE.creator}, ${SITE_URL}${hallPath(hall)}, ${GD_HALL_LICENCE.name}`;
  return (
    <EntityFrame>
      <JsonLd data={hallJsonLd(hall)} />
      <Trail href="/gd/halls">Temple halls</Trail>
      <h1>{title}</h1>
      <Lede>{lead.lead}</Lede>

      <figure className={styles.figure}>
        {/* A plain image: the files are static, sized and carry their
            licence, which the image optimiser would strip (plan 062). */}
        {/* biome-ignore lint/performance/noImgElement: see above */}
        <img
          src={files.png.path}
          srcSet={`${files.medium.path} ${files.medium.width}w, ${files.png.path} ${files.png.width}w`}
          sizes="(max-width: 599.95px) calc(100vw - 32px), 568px"
          width={files.png.width}
          height={files.png.height}
          alt={hallAlt(hall)}
          fetchPriority="high"
          aria-describedby="hall-stations"
          className={styles.image}
        />
        <figcaption className={styles.caption}>
          Floor plan © 2026 Magick.ly,{" "}
          <Link href={GD_HALL_LICENCE.url}>CC BY 4.0</Link>. Free to reuse with
          credit (<Link href="#licence">how</Link>).
        </figcaption>
      </figure>

      <p className={styles.actions}>
        <Link href={`/gd/halls/editor#preset=${hall.slug}`}>
          Open in the editor
        </Link>
        {/* Files, not pages: nothing to prefetch. */}
        <Link href={files.png.path} download={files.png.name} prefetch={false}>
          Download PNG
        </Link>
        <Link href={files.svg.path} download={files.svg.name} prefetch={false}>
          Download SVG
        </Link>
      </p>

      <section id="hall-stations" aria-labelledby="hall-stations-heading">
        <h2 id="hall-stations-heading">In the hall</h2>
        <EntityTable>
          {stations.officers.map((officer, i) => (
            // Two officers may share a role; the order never changes.
            // biome-ignore lint/suspicious/noArrayIndexKey: see above
            <Row key={`o${i}`} label={capitalised(officer.name)}>
              {officer.where}
            </Row>
          ))}
          {stations.altars.map((altar, i) =>
            // An altar with nothing on it is furniture like the rest.
            altar.items.length ? (
              // biome-ignore lint/suspicious/noArrayIndexKey: altars keep their order
              <Row key={`a${i}`} label={`On the ${altar.name}`}>
                {`${listed(altar.items)} (${altar.where})`}
              </Row>
            ) : (
              // biome-ignore lint/suspicious/noArrayIndexKey: as above
              <Row key={`a${i}`} label={capitalised(altar.name)}>
                {altar.where}
              </Row>
            ),
          )}
          {stations.furniture.map((thing, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: as for the officers
            <Row key={`f${i}`} label={capitalised(thing.name)}>
              {thing.where}
            </Row>
          ))}
        </EntityTable>
        <p className={styles.note}>
          East is at the top of the plan and North on the left; stations are
          where the drawing places each one.
        </p>
      </section>

      <h2>Sources</h2>
      {lead.sources ? <p>{lead.sources}</p> : null}
      <ul>
        {/* The book pages only: the site's old drawings, which some
            presets were ported from, are no source for a reader. */}
        {preset.sources
          .filter((source) => source.kind === "book")
          .map((source) => (
            <li key={hallSourceText(source)}>
              <Link href={hallSourceUrl(source)}>{hallSourceText(source)}</Link>
            </li>
          ))}
      </ul>
      <p>
        The layout is taken from these sources and drawn with our own art; no
        text or image from them is reproduced.
      </p>

      <h2 id="licence">Licence</h2>
      <p>
        This floor plan is © 2026 Magick.ly and licensed under{" "}
        <Link href={GD_HALL_LICENCE.url}>CC BY 4.0</Link>: a Creative Commons
        licence sits on top of copyright, and this one lets anyone use, change
        and sell the image, with credit. Give the title, the author, the source
        and the licence, for example:
      </p>
      <blockquote className={styles.credit}>{credit}</blockquote>
      <p>
        The presets' data and the code that draws them are{" "}
        <Link href="https://github.com/gadicc/magickly/tree/main/src/components">
          MIT
        </Link>
        ; see <Link href="/about#licence">About</Link>.
      </p>

      <PrevNext
        label="Temple halls"
        prev={neighbour(GD_HALLS[index - 1])}
        next={neighbour(GD_HALLS[index + 1])}
      />
    </EntityFrame>
  );
}
