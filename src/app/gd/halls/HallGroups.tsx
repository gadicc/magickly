"use client";

import { estimateHallAspect } from "@magick-components/gd/hall/aspect";
import type { HallNode } from "@magick-components/gd/hall/types";
import { CircularProgress, Typography } from "@mui/material";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React from "react";
import { GdHallFrame } from "@/doc/ritualBlocks/GdHallFrame";
import type { RitualHall } from "@/doc/ritualHalls";
import { createDrawQueue, type DrawQueue } from "./drawQueue";
import styles from "./templeHalls.module.css";

const HallViewer = dynamic(
  () =>
    import("@/app/doc/[_id]/HallViewer").then((module) => module.HallViewer),
  { ssr: false },
);

/**
 * Where one ritual's halls stand: being read from the device, fetched to
 * it, waiting for the member to fetch it (Save-Data, offline or an
 * interrupted round), failed, fetched but still not readable once the
 * round has settled, or read. A denied ritual is not shown.
 */
export type RitualStatus =
  | { kind: "reading" }
  | { kind: "fetching" }
  | { kind: "waiting" }
  | { kind: "failed" }
  | { kind: "unreadable" }
  | { kind: "denied" }
  | { kind: "ready"; halls: readonly RitualHall[] };

/** Thumbnails drawn per animation frame. */
const THUMBNAILS_PER_FRAME = 2;
let thumbnailQueue: DrawQueue | undefined;
const thumbnails = () =>
  (thumbnailQueue ??= createDrawQueue({ perFrame: THUMBNAILS_PER_FRAME }));

const hallOf = (hall: RitualHall) => hall.row as unknown as HallNode;

/**
 * A hall's thumbnail, drawn only once it scrolls near the view, and then
 * through the shared queue, a few per frame. Until then it holds the
 * hall's estimated shape.
 */
function LazyHallThumbnail({ hall }: { hall: RitualHall }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [draw, setDraw] = React.useState(false);
  const aspect = React.useMemo(() => estimateHallAspect(hallOf(hall)), [hall]);
  React.useEffect(() => {
    const element = ref.current as HTMLDivElement;
    const cancels: (() => void)[] = [];
    const start = () => {
      cancels.push(thumbnails().enqueue(() => setDraw(true)));
    };
    const cancel = () => {
      for (const job of cancels) job();
    };
    if (typeof IntersectionObserver !== "function") {
      start();
      return cancel;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        start();
      },
      { rootMargin: "200px" },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      cancel();
    };
  }, []);
  return (
    <div
      ref={ref}
      className={styles.thumb}
      style={draw ? undefined : { aspectRatio: aspect }}
      data-drawn={draw || undefined}
      aria-hidden="true"
    >
      {draw && <GdHallFrame hall={hallOf(hall)} />}
    </div>
  );
}

/** Full page loads, through one object so tests can watch them. */
export const fullPageNavigation = {
  assign(href: string) {
    window.location.assign(href);
  },
};

/** A link to a ritual: in-app, or a full navigation the offline shell serves. */
function RitualLink({
  id,
  href,
  full,
  children,
}: {
  id?: string;
  href: string;
  full: boolean;
  children: React.ReactNode;
}) {
  return full ? (
    <a id={id} href={href}>
      {children}
    </a>
  ) : (
    <Link id={id} href={href} prefetch={false}>
      {children}
    </Link>
  );
}

/**
 * Rituals' halls grouped by ritual (plan 069, mock-ups E–F), for a temple's
 * tab on `/gd/halls` and for Halls on this device on `/offline/ritual`:
 * each group's heading links to its ritual, each card is a hall's lazy
 * thumbnail, name and context, and opens the reader's viewer with that
 * ritual's halls. The halls are the caller's, held in memory; the viewer
 * closes when its ritual's halls go.
 *
 * `fullNavigation` makes every way into a ritual a full page load, which
 * the service worker serves from the offline shell; an in-app navigation
 * offline would need the network.
 */
export function HallGroups({
  rituals,
  statuses,
  idPrefix,
  fullNavigation = false,
  offlineBadge = false,
}: {
  /** In the order shown. */
  rituals: readonly { id: string; title: string }[];
  statuses: ReadonlyMap<string, RitualStatus>;
  /** Makes the headings' ids unique on the page. */
  idPrefix: string;
  fullNavigation?: boolean;
  /** Marks each read ritual "✓ offline". */
  offlineBadge?: boolean;
}) {
  const router = useRouter();
  const [viewer, setViewer] = React.useState<{
    ritualId: string;
    index: number | null;
  } | null>(null);
  const viewing = viewer ? statuses.get(viewer.ritualId) : undefined;
  const viewingHalls =
    viewing?.kind === "ready" && viewing.halls.length > 0
      ? viewing.halls
      : null;
  // Halls that go (hidden, another account) close the viewer for good.
  React.useEffect(() => {
    if (viewer && !viewingHalls) setViewer(null);
  }, [viewer, viewingHalls]);

  return (
    <>
      <div className={styles.groups}>
        {rituals.map((ritual) => {
          const status = statuses.get(ritual.id) ?? { kind: "reading" };
          const headingId = `${idPrefix}-${ritual.id}`;
          return (
            <section
              key={ritual.id}
              aria-labelledby={headingId}
              className={styles.group}
            >
              <h3>
                <RitualLink
                  id={headingId}
                  href={`/doc/${ritual.id}`}
                  full={fullNavigation}
                >
                  {ritual.title}
                </RitualLink>
                {offlineBadge && status.kind === "ready" && (
                  <Typography
                    component="span"
                    variant="caption"
                    color="success"
                  >
                    ✓ offline
                  </Typography>
                )}
              </h3>
              <ul className={styles.halls}>
                {status.kind === "ready" ? (
                  status.halls.map((hall, index) => (
                    <li key={hall.ordinal}>
                      <button
                        type="button"
                        aria-describedby={headingId}
                        className={styles.card}
                        onClick={() =>
                          setViewer({ ritualId: ritual.id, index })
                        }
                      >
                        <LazyHallThumbnail hall={hall} />
                        <Typography
                          component="span"
                          variant="inherit"
                          color="primary"
                          className={styles.name}
                        >
                          {hall.name}
                        </Typography>
                        {hall.context && (
                          <span className={styles.context}>{hall.context}</span>
                        )}
                      </button>
                    </li>
                  ))
                ) : (
                  <li>
                    <div className={styles.placeholder}>
                      {status.kind === "fetching" ? (
                        <span>
                          <CircularProgress
                            size={16}
                            aria-hidden="true"
                            sx={{ display: "block", mx: "auto", mb: 1 }}
                          />
                          Fetching this ritual to this device…
                        </span>
                      ) : status.kind === "waiting" ? (
                        "Not on this device yet."
                      ) : status.kind === "failed" ? (
                        "This ritual could not be fetched."
                      ) : status.kind === "unreadable" ? (
                        <span>
                          Not available on this device.{" "}
                          <RitualLink
                            href={`/doc/${ritual.id}`}
                            full={fullNavigation}
                          >
                            Open the ritual
                          </RitualLink>
                        </span>
                      ) : (
                        <CircularProgress
                          size={16}
                          aria-label={`Reading ${ritual.title}`}
                        />
                      )}
                    </div>
                  </li>
                )}
              </ul>
            </section>
          );
        })}
      </div>
      {viewer && viewingHalls && (
        <HallViewer
          halls={viewingHalls}
          index={viewer.index}
          onIndexChange={(index) =>
            setViewer({ ritualId: viewer.ritualId, index })
          }
          onClose={() => setViewer({ ritualId: viewer.ritualId, index: null })}
          onGoTo={(hall) => {
            const href = `/doc/${viewer.ritualId}#hall-${hall.ordinal}`;
            if (fullNavigation) fullPageNavigation.assign(href);
            else router.push(href);
          }}
        />
      )}
    </>
  );
}
