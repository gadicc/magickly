/**
 * The tablet as pyramids in 3D, in the page's tablet box (plan 101), which
 * `Tablet3DLoader` loads only when the reader asks for it. One renderer
 * for as long as the view is open: another tablet, version or theme
 * changes what it draws, never the WebGL context.
 */
import { useColorScheme } from "@mui/material/styles";
import type { TabletHighlights } from "magick-components/enochian/Tablet";
import type { TabletView } from "magick-data/enochian/tablets";
import React from "react";
import {
  PerspectiveCamera,
  Raycaster,
  Scene,
  type Texture,
  Vector2,
} from "three";
import { useUiLanguage } from "@/i18n/LocaleProvider";
import { type Orbit, type OrbitView, orbit } from "@/three/orbit";
import {
  createViewer,
  MAX_PIXEL_RATIO,
  roomEnvironment,
  type Viewer,
} from "@/three/viewer";
import styles from "../tablets.module.css";
import { chosenBy, squareTints } from "./highlights";
import { MARKS_SHEET, MARKS_SHEET_SVG } from "./marksSheet.generated";
import { type Tablet3DModel, tabletModel } from "./model";
import {
  ENVIRONMENT_INTENSITY,
  rasteriseSheet,
  sheetCellPixels,
  sheetTexture,
  type TabletObject,
  tabletObject,
} from "./tabletObject";

/** Why the view cannot be shown: no WebGL 2, or its code did not load. */
export type Unavailable = "webgl" | "load";

export interface Tablet3DProps {
  view: TabletView;
  /** The reversed letters drawn mirrored, as on the flat drawing. */
  mirrorReversed: boolean;
  /** The view's accessible name. */
  label: string;
  /** Called when the view cannot be shown, so the page draws it flat. */
  unavailable: (why: Unavailable) => void;
  /** The flat drawing's highlights: tinted, and a click chooses by them. */
  highlights?: TabletHighlights;
}

/** From the tablet's near edge, 55° up. */
export const HOME_VIEW: Readonly<OrbitView> = Object.freeze({
  azimuth: 0,
  elevation: (55 * Math.PI) / 180,
  zoom: 1,
});

/** The ground under the tablet, in each scheme; the box's is CSS's. */
const GROUND = { light: "#8f8a80", dark: "#4a5262" } as const;

export default function Tablet3D({
  view,
  mirrorReversed,
  label,
  unavailable,
  highlights,
}: Tablet3DProps) {
  const { t } = useUiLanguage();
  // The scheme is read here, as by the ritual source editor, because the
  // ground is drawn beyond CSS's reach; the view mounts after hydration.
  const ground =
    GROUND[useColorScheme().colorScheme === "dark" ? "dark" : "light"];
  const box = React.useRef<HTMLDivElement>(null);
  const [{ scene, camera }] = React.useState(() => ({
    scene: Object.assign(new Scene(), {
      environmentIntensity: ENVIRONMENT_INTENSITY,
    }),
    camera: new PerspectiveCamera(30, 1, 0.1, 100),
  }));
  const live = React.useRef<{
    viewer?: Viewer;
    orbit?: Orbit;
    tablet?: TabletObject;
    model?: Tablet3DModel;
    sheet?: Promise<Texture>;
  }>({});
  const [drawn, setDrawn] = React.useState(false);
  const latest = React.useRef({ ground, unavailable, highlights });
  latest.current = { ground, unavailable, highlights };
  /** A click or tap at a client point: the square under it, if it may. */
  const clicked = (x: number, y: number) => {
    const { tablet } = live.current;
    const { highlights } = latest.current;
    const rect = box.current?.getBoundingClientRect();
    if (!tablet || !rect) return;
    const ray = new Raycaster();
    ray.setFromCamera(
      new Vector2(
        ((x - rect.left) / rect.width) * 2 - 1,
        ((rect.top - y) / rect.height) * 2 + 1,
      ),
      camera,
    );
    const hit = tablet.pick(ray.ray);
    const square = hit && chosenBy(highlights, hit);
    if (square) highlights?.onSelect?.(square);
  };
  const clickedRef = React.useRef(clicked);
  clickedRef.current = clicked;

  // The renderer and the mark sheet's texture, made once.
  React.useEffect(() => {
    const element = box.current;
    if (!element) return;
    let viewer: Viewer;
    try {
      viewer = createViewer(element, {
        scene,
        camera,
        environment: roomEnvironment,
        resized: () => live.current.orbit?.fit(),
      });
    } catch {
      latest.current.unavailable("webgl");
      return;
    }
    viewer.renderer.domElement.setAttribute("aria-hidden", "true");
    const anisotropy = viewer.renderer.capabilities.getMaxAnisotropy();
    const sheet = rasteriseSheet(
      MARKS_SHEET_SVG,
      MARKS_SHEET,
      sheetCellPixels(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO)),
    ).then((image) => sheetTexture(image, Math.min(8, anisotropy)));
    live.current = { viewer, sheet };
    return () => {
      live.current.orbit?.dispose();
      live.current = {};
      sheet.then(
        (texture) => texture.dispose(),
        () => {},
      );
      viewer.dispose();
    };
  }, [scene, camera]);

  // The tablet, again for another tablet, version or mirroring, in the
  // same renderer, with the same sheet and the reader's turn kept.
  React.useEffect(() => {
    const { viewer, sheet } = live.current;
    const element = box.current;
    if (!viewer || !sheet || !element) return;
    let tablet: TabletObject | undefined;
    let gone = false;
    sheet.then(
      (texture) => {
        if (gone) return;
        const model = tabletModel(view, MARKS_SHEET, { mirrorReversed });
        tablet = tabletObject(model, MARKS_SHEET, texture, {
          ground: latest.current.ground,
        });
        tablet.setTints(squareTints(model, latest.current.highlights));
        Object.assign(live.current, { tablet, model });
        scene.add(tablet.object);
        if (live.current.orbit) live.current.orbit.fit(tablet.bounds);
        else
          live.current.orbit = orbit(element, camera, {
            home: HOME_VIEW,
            bounds: tablet.bounds,
            changed: viewer.invalidate,
            clicked: (x, y) => clickedRef.current(x, y),
          });
        viewer.invalidate();
        setDrawn(true);
      },
      () => !gone && latest.current.unavailable("load"),
    );
    return () => {
      gone = true;
      tablet?.object.removeFromParent();
      tablet?.dispose();
      // Nothing tints or picks a tablet that is gone.
      if (live.current.tablet === tablet)
        live.current.tablet = live.current.model = undefined;
    };
  }, [view, mirrorReversed, scene, camera]);

  // The highlights, drawn only when they change what is tinted.
  React.useEffect(() => {
    const { tablet, model, viewer } = live.current;
    if (tablet && model && tablet.setTints(squareTints(model, highlights)))
      viewer?.invalidate();
  }, [highlights]);

  // The theme.
  React.useEffect(() => {
    live.current.tablet?.setGround(ground);
    live.current.viewer?.invalidate();
  }, [ground]);

  return (
    <div
      ref={box}
      className={styles.view3d}
      role="group"
      tabIndex={0}
      aria-roledescription={t(/*i18n*/ "3D view")}
      aria-label={label}
    >
      {!drawn && (
        <p className={styles.view3dStatus}>
          {t(/*i18n*/ "Loading the 3D view…")}
        </p>
      )}
    </div>
  );
}
