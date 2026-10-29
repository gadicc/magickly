import { Typography } from "@mui/material";
import Link from "next/link";
import type { GdHallEntry } from "@/render/contracts/gdHall";
import { hallFiles, hallGroupName, hallGroups, hallPath } from "@/seo/halls";
import styles from "./hallPage.module.css";

/** Where the rail is shown (`hallPage.module.css`). */
export const RAIL_MEDIA = "(min-width: 900px)";

/** A transparent pixel, inline: the thumbnails' fallback where none is shown. */
export const BLANK =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

/**
 * Every hall beside the one on the page (plan 062's amendment, A4): on
 * the desktop, a sticky column of the halls' thumbnails by grade, the
 * current one outlined and marked as the current page. It comes last in
 * the page's markup, so a screen reader meets the hall before fourteen
 * links, and the grid sets it on the left. Phones hide it, and only a
 * screen that shows it fetches its thumbnails.
 */
export default function HallRail({ current }: { current: GdHallEntry }) {
  return (
    <nav aria-label="All temple halls" className={styles.rail}>
      <p className={styles.railAll}>
        <Link href="/gd/halls" prefetch={false}>
          All temple halls
        </Link>
      </p>
      {hallGroups().map((group) => {
        const name = hallGroupName(group);
        return (
          <div key={group.grade} className={styles.railGroup}>
            <p className={styles.railGrade} aria-hidden="true">
              {name}
            </p>
            <ul aria-label={name}>
              {group.halls.map((card) => {
                const { small } = hallFiles(card.hall);
                const here = card.hall.slug === current.slug;
                return (
                  <li key={card.hall.slug}>
                    {/* No prefetch: each hall page preloads its full
                        image. */}
                    <Link
                      href={hallPath(card.hall)}
                      prefetch={false}
                      aria-current={here ? "page" : undefined}
                      className={styles.railHall}
                    >
                      {/* The theme's link colour, which the current
                          hall's outline takes too. */}
                      <Typography
                        component="span"
                        variant="inherit"
                        color="primary"
                        className={styles.railCard}
                      >
                        {/* Only a screen as wide as the rail's fetches
                            the thumbnail: below 900 px the rail is not
                            shown, and Chromium fetches lazy images in a
                            hidden subtree all the same. The fallback is
                            an inline blank, which costs no request. */}
                        <picture>
                          <source
                            media={RAIL_MEDIA}
                            srcSet={small.path}
                            width={small.width}
                            height={small.height}
                          />
                          <img
                            src={BLANK}
                            width={small.width}
                            height={small.height}
                            alt=""
                            loading="lazy"
                            decoding="async"
                          />
                        </picture>
                        <span>
                          <span className={styles.hidden}>{name}, </span>
                          {card.place || card.part}
                        </span>
                      </Typography>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
