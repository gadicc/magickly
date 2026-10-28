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
  hallCardLabel,
  hallFiles,
  hallGroupName,
  hallGroups,
  hallJsonLd,
  hallPath,
  hallStations,
  listed,
} from "@/seo/halls";
import JsonLd from "@/seo/JsonLd";
import { SITE_URL } from "@/seo/site";
import HallJump from "./HallJump";
import HallRail from "./HallRail";
import styles from "./hallPage.module.css";

/** "yellow lantern" → "Yellow lantern", for a row's label. */
const capitalised = (name: string) =>
  name.charAt(0).toUpperCase() + name.slice(1);

/**
 * One temple hall's page (plan 062, decision 2): the hall as a real image
 * at its canonical URL, what it shows in our own words, where its layout
 * comes from, and its licence, with every other hall beside it (plan 062's
 * amendment). A Server Component, synchronous so that `renderToString` can
 * render it in tests; its one piece of client code is the phone's "Jump to
 * hall" select.
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
  const prev = neighbour(GD_HALLS[index - 1]);
  const next = neighbour(GD_HALLS[index + 1]);
  // The select's choices, from the same groups and labels as the rail.
  const jump = hallGroups().map((group) => ({
    name: hallGroupName(group),
    halls: group.halls.map((card) => ({
      href: hallPath(card.hall),
      label: `${group.grade} · ${hallCardLabel(card)}`,
    })),
  }));
  // The grid (plan 062's amendment, A4) places these on the desktop: the
  // rail, the plan and the words in three columns from 1,200 px, the rail
  // and one column from 900 px. Below that the markup's order is the
  // phone's, with the lede moved after the actions.
  return (
    <EntityFrame maxWidth="lg">
      <JsonLd data={hallJsonLd(hall)} />
      <div className={styles.page}>
        <div className={styles.top}>
          <Trail href="/gd/halls">Temple halls</Trail>
          <HallJump groups={jump} current={hallPath(hall)} />
        </div>
        <h1 className={styles.title}>{title}</h1>

        <figure className={styles.figure}>
          {/* A plain image: the files are static, sized and carry their
            licence, which the image optimiser would strip (plan 062). */}
          {/* biome-ignore lint/performance/noImgElement: see above */}
          <img
            src={files.png.path}
            srcSet={`${files.medium.path} ${files.medium.width}w, ${files.png.path} ${files.png.width}w`}
            sizes="(max-width: 599.95px) calc(100vw - 32px), (max-width: 1199.95px) 568px, 480px"
            width={files.png.width}
            height={files.png.height}
            alt={hallAlt(hall)}
            fetchPriority="high"
            aria-describedby="hall-stations"
            className={styles.image}
          />
          <figcaption className={styles.caption}>
            Floor plan © 2026 Magick.ly,{" "}
            <Link href={GD_HALL_LICENCE.url}>CC BY 4.0</Link>. Free to reuse
            with credit (<Link href="#licence">how</Link>).
          </figcaption>
        </figure>

        <div className={styles.words}>
          <Lede>{lead.lead}</Lede>
          <p className={styles.actions}>
            <Link href={`/gd/halls/editor#preset=${hall.slug}`}>
              Open in the editor
            </Link>
            {/* Files, not pages: nothing to prefetch. */}
            <Link
              href={files.png.path}
              download={files.png.name}
              prefetch={false}
            >
              Download PNG
            </Link>
            <Link
              href={files.svg.path}
              download={files.svg.name}
              prefetch={false}
            >
              Download SVG
            </Link>
          </p>
          <div className={styles.near}>
            <PrevNext label="Previous and next halls" prev={prev} next={next} />
          </div>

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
            {preset.sources.map((source) => (
              <li key={hallSourceText(source)}>
                <Link href={hallSourceUrl(source)}>
                  {hallSourceText(source)}
                </Link>
              </li>
            ))}
          </ul>
          <p>
            The layout is taken from these sources and drawn with our own art;
            no text or image from them is reproduced.
          </p>

          <h2 id="licence">Licence</h2>
          <p>
            This floor plan is © 2026 Magick.ly and licensed under{" "}
            <Link href={GD_HALL_LICENCE.url}>CC BY 4.0</Link>: a Creative
            Commons licence sits on top of copyright, and this one lets anyone
            use, change and sell the image, with credit. Give the title, the
            author, the source and the licence, for example:
          </p>
          <blockquote className={styles.credit}>{credit}</blockquote>
          <p>
            The presets' data and the code that draws them are{" "}
            <Link href="https://github.com/gadicc/magickly/tree/main/src/components">
              MIT
            </Link>
            ; see <Link href="/about#licence">About</Link>.
          </p>

          <PrevNext label="More temple halls" prev={prev} next={next} />
        </div>
        <HallRail current={hall} />
      </div>
    </EntityFrame>
  );
}
