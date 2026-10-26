import Link from "next/link";
import { GD_HALLS, type GdHallEntry } from "@/render/contracts/gdHall";
import { hallFiles, hallPath } from "@/seo/halls";
import styles from "./hallGallery.module.css";

/** The halls by grade, in the presets' order. */
function byGrade(): { grade: string; halls: GdHallEntry[] }[] {
  const groups: { grade: string; halls: GdHallEntry[] }[] = [];
  for (const hall of GD_HALLS) {
    const grade = hall.number ? `${hall.grade} ${hall.number}` : hall.grade;
    const group = groups.at(-1);
    if (group?.grade === grade) group.halls.push(hall);
    else groups.push({ grade, halls: [hall] });
  }
  return groups;
}

/** "Part 1", "32nd path", "In Hod", or the grade's own hall. */
const label = (hall: GdHallEntry) => {
  const part = hall.part.replace(/^,? /, "");
  return part ? part.charAt(0).toUpperCase() + part.slice(1) : "The hall";
};

/**
 * `/gd/hall`'s presets, each linking to its page (plan 062, decision 12):
 * server-rendered thumbnails below the editor, which load lazily and add
 * no client code.
 */
export default function HallGallery() {
  return (
    <section
      id="halls"
      aria-labelledby="halls-heading"
      className={styles.gallery}
    >
      <h2 id="halls-heading">The presets</h2>
      <p>
        Each preset hall has a page of its own, with its floor plan to download
        under CC BY 4.0, where each officer stands, and the sources it follows.
      </p>
      {byGrade().map(({ grade, halls }) => (
        <section key={grade} aria-label={grade}>
          <h3>{grade}</h3>
          <ul className={styles.halls}>
            {halls.map((hall) => {
              const { small } = hallFiles(hall);
              return (
                <li key={hall.slug}>
                  {/* No prefetch: a hall page's payload preloads its
                      full image, fourteen of which the list would fetch
                      as it scrolls into view. Next's own link, which the
                      page already loads, rather than the MUI one, which
                      would add a kilobyte to the page's chunk. */}
                  <Link
                    href={hallPath(hall)}
                    className={styles.hall}
                    prefetch={false}
                  >
                    {/* biome-ignore lint/performance/noImgElement: a static, sized thumbnail */}
                    <img
                      src={small.path}
                      width={small.width}
                      height={small.height}
                      alt=""
                      loading="lazy"
                      decoding="async"
                    />
                    <span>
                      {/* The visible name is the part; a screen reader
                          hears the grade too. */}
                      <span className={styles.hidden}>{grade}, </span>
                      {label(hall)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </section>
  );
}
