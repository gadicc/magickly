"use client";
/**
 * The 3D view's loader (plan 101): on the page's first load, so it stays
 * outside `three/`, whose modules the build check keeps off it. three.js
 * and the view are fetched only when it renders, and never on the server.
 */
import dynamic from "next/dynamic";
import React from "react";
import { useUiLanguage } from "@/i18n/LocaleProvider";
import styles from "./tablets.module.css";
import type { Tablet3DProps } from "./three/Tablet3D";

/**
 * The 3D box's width over its height: the tablet's grid, a Watchtower's
 * 12 by 13 squares or the Union's 5 by 4, as it looks from the view's
 * home, 55° up, where its depth shows at about three quarters (measured
 * on the first frames). The page sets it as `--tablet-ratio`, which
 * sizes the box.
 */
export const tablet3DRatio = (union: boolean) =>
  union ? 5 / (4 * 0.75) : 12 / (13 * 0.75);

function Loading() {
  const { t } = useUiLanguage();
  return (
    <div className={styles.view3d}>
      <p className={styles.view3dStatus}>
        {t(/*i18n*/ "Loading the 3D view…")}
      </p>
    </div>
  );
}

/**
 * In the view's place once its code has failed to load. `next/dynamic`
 * keeps that result, so each time the reader asks again this tries a
 * fresh `import()` (webpack fetches a failed chunk again), shows the
 * view if it comes, and otherwise tells the page, which draws flat.
 */
function NotLoaded(props: Tablet3DProps) {
  const [View, setView] = React.useState<React.ComponentType<Tablet3DProps>>();
  const { unavailable } = props;
  React.useEffect(() => {
    let live = true;
    import(/* webpackChunkName: "tablet3d" */ "./three/Tablet3D").then(
      (loaded) => live && setView(() => loaded.default),
      () => live && unavailable("load"),
    );
    return () => {
      live = false;
    };
  }, [unavailable]);
  return View ? <View {...props} /> : <Loading />;
}

/*
 * `webpackChunkName` survives `next/dynamic` and names the view's chunk
 * ("tablet3d") in the build's output. The precache leaves out the 3D
 * chunks by their modules, not by this name (`next.config.ts`).
 */
const Tablet3DLoader = dynamic<Tablet3DProps>(
  () =>
    import(/* webpackChunkName: "tablet3d" */ "./three/Tablet3D").catch(() => ({
      default: NotLoaded,
    })),
  { ssr: false, loading: Loading },
);

export default Tablet3DLoader;
