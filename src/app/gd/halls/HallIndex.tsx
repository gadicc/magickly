import { Typography } from "@mui/material";
import Link from "next/link";
import { hallFiles, hallGroupName, hallGroups, hallPath } from "@/seo/halls";
import styles from "./hallIndex.module.css";

/**
 * The temple halls by grade (plan 062's amendment, sheet A1): each grade's
 * cards in a row, the grades flowing in one wrapping grid, so that all
 * fourteen sit on one desktop screen. Each card is a hall's small PNG,
 * loaded lazily, with its label, and links to the hall's page. No client
 * code.
 */
export default function HallIndex() {
  return (
    <div className={styles.groups}>
      {hallGroups().map((group) => {
        const name = hallGroupName(group);
        return (
          <section key={group.grade} aria-label={name} className={styles.group}>
            <h3>
              {group.grade}
              {group.number && (
                <span className={styles.number}> {group.number}</span>
              )}
            </h3>
            <ul className={styles.halls}>
              {group.halls.map((card) => {
                const { small } = hallFiles(card.hall);
                return (
                  <li key={card.hall.slug}>
                    {/* No prefetch: a hall page's payload preloads its
                        full image, fourteen of which the grid would fetch
                        as it comes into view. Next's own link rather
                        than the MUI one, which would add a kilobyte. */}
                    <Link
                      href={hallPath(card.hall)}
                      className={styles.hall}
                      prefetch={false}
                    >
                      {/* The theme's link colour, which the hover
                          border takes too. */}
                      <Typography
                        component="span"
                        variant="inherit"
                        color="primary"
                        className={styles.card}
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
                        <span className={styles.label}>
                          {/* The visible label is the part; a screen
                              reader hears the grade too. */}
                          <span className={styles.hidden}>{name}, </span>
                          <span>{card.part}</span>
                          {card.place && (
                            <span className={styles.place}>
                              <span className={styles.dot} aria-hidden="true">
                                {" · "}
                              </span>
                              <span className={styles.hidden}>, </span>
                              {card.place}
                            </span>
                          )}
                        </span>
                      </Typography>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
