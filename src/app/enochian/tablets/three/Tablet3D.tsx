/**
 * The tablet as pyramids in 3D, in the page's tablet box (plan 101), which
 * `Tablet3DLoader` loads only when the reader asks for it. One renderer
 * for as long as the view is open: another tablet, version or theme
 * changes what it draws, never the WebGL context.
 */
import { useColorScheme } from "@mui/material/styles";
import type { TabletView } from "magick-data/enochian/tablets";
import React from "react";
import { PerspectiveCamera, Scene } from "three";
import { useUiLanguage } from "@/i18n/LocaleProvider";
import { type Orbit, type OrbitView, orbit } from "@/three/orbit";
import {
  createViewer,
  MAX_PIXEL_RATIO,
  roomEnvironment,
  type Viewer,
} from "@/three/viewer";
import styles from "../tablets.module.css";
import { MARKS_SHEET, MARKS_SHEET_SVG } from "./marksSheet.generated";
import { tabletModel } from "./model";
import {
  ENVIRONMENT_INTENSITY,
  rasteriseSheet,
  sheetCellPixels,
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
    sheet?: Promise<HTMLCanvasElement>;
  }>({});
  const [drawn, setDrawn] = React.useState(false);
  const latest = React.useRef({ ground, unavailable });
  latest.current = { ground, unavailable };

  // The renderer, made once.
  React.useEffect(() => {
    const element = box.current;
    if (!element) return;
    try {
      live.current.viewer = createViewer(element, {
        scene,
        camera,
        environment: roomEnvironment,
        resized: () => live.current.orbit?.fit(),
      });
    } catch {
      latest.current.unavailable("webgl");
      return;
    }
    live.current.viewer.renderer.domElement.setAttribute("aria-hidden", "true");
    return () => {
      live.current.viewer?.dispose();
      live.current.viewer = undefined;
    };
  }, [scene, camera]);

  // The tablet, again for another tablet, version or mirroring.
  React.useEffect(() => {
    const { viewer } = live.current;
    const element = box.current;
    if (!viewer || !element) return;
    let gone = false;
    const sheet = (live.current.sheet ??= rasteriseSheet(
      MARKS_SHEET_SVG,
      MARKS_SHEET,
      sheetCellPixels(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO)),
    ));
    sheet.then(
      (image) => {
        if (gone) return;
        const model = tabletModel(view, MARKS_SHEET, { mirrorReversed });
        const tablet = tabletObject(model, MARKS_SHEET, image, {
          anisotropy: Math.min(
            8,
            viewer.renderer.capabilities.getMaxAnisotropy(),
          ),
          ground: latest.current.ground,
        });
        live.current.tablet = tablet;
        scene.add(tablet.object);
        live.current.orbit = orbit(element, camera, {
          home: HOME_VIEW,
          bounds: tablet.bounds,
          changed: viewer.invalidate,
        });
        viewer.invalidate();
        setDrawn(true);
      },
      () => !gone && latest.current.unavailable("load"),
    );
    return () => {
      gone = true;
      const { tablet, orbit: controls } = live.current;
      controls?.dispose();
      if (tablet) {
        tablet.object.removeFromParent();
        tablet.dispose();
      }
      live.current.tablet = live.current.orbit = undefined;
    };
  }, [view, mirrorReversed, scene, camera]);

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
