"use client";

import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import { Box, IconButton, Paper } from "@mui/material";
import React from "react";
import {
  arrowPan,
  clampView,
  fitDrawing,
  IDENTITY,
  isDoubleTap,
  MAX_SCALE,
  MIN_SCALE,
  type Point,
  panBy,
  pinch,
  swipeDirection,
  TAP_DISTANCE,
  type Tap,
  type View,
  wheelFactor,
  ZOOM_STEP,
  zoomAt,
  zoomBy,
  zoomKey,
} from "@/doc/hallPanZoom";

/** The gesture in progress, from where it (or its latest phase) began. */
type Gesture =
  | { kind: "drag"; start: View; from: Point; moved: boolean }
  | { kind: "pinch"; start: View; from: [Point, Point] };

/**
 * Pan and zoom around a hall's drawing (plan 069, decision 6), our own
 * rather than a dependency: two fingers pinch (and drag), one finger or the
 * mouse drags when zoomed in, Ctrl+wheel (and a trackpad's pinch) zooms on
 * the desktop, the keys +, − and 0 and the buttons zoom too, the arrow
 * keys pan, and a double tap resets. At 1×, a sideways swipe or ← and →
 * call `onSwipe` instead. The surface takes every touch (`touch-action:
 * none`), or iOS Safari would zoom the page. Its parent gives it a new
 * `key` to reset it.
 */
export function HallPanZoom({
  aspect,
  active,
  onSwipe,
  label = "Hall drawing",
  children,
}: {
  /** The drawing's width over its height, to fit it to the surface. */
  aspect: number;
  /** Whether the viewer is open: only then are the keys its own. */
  active: boolean;
  onSwipe?: (direction: "next" | "previous") => void;
  /** The surface's accessible name: what it shows. */
  label?: string;
  children: React.ReactNode;
}) {
  const surface = React.useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = React.useState({ width: 0, height: 0 });
  const size = React.useMemo(
    () => fitDrawing(measured, aspect),
    [measured, aspect],
  );
  const [view, setView] = React.useState<View>(IDENTITY);
  // The view as last computed, ahead of the render that shows it: a
  // gesture's next phase starts from it.
  const viewRef = React.useRef(view);
  const commit = React.useCallback((next: View) => {
    viewRef.current = next;
    setView(next);
  }, []);
  // What the zoom level last announced; not every frame of a gesture.
  const [announced, setAnnounced] = React.useState(1);
  const announce = React.useCallback(
    () => setAnnounced(viewRef.current.scale),
    [],
  );
  // Event handlers read the latest values without re-subscribing.
  const latest = React.useRef({ size, onSwipe });
  latest.current = { size, onSwipe };
  const pointers = React.useRef(new Map<number, Point>());
  const gesture = React.useRef<Gesture | null>(null);
  // Whether the gesture had two fingers at any time: then it is no swipe.
  const multi = React.useRef(false);
  const lastTap = React.useRef<Tap | null>(null);

  React.useLayoutEffect(() => {
    const element = surface.current as HTMLDivElement;
    const measure = () => {
      const { width, height } = element.getBoundingClientRect();
      setMeasured({ width, height });
      commit(clampView(viewRef.current, fitDrawing({ width, height }, aspect)));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [aspect, commit]);

  const zoom = React.useCallback(
    (action: "in" | "out" | "reset") => {
      commit(
        action === "reset"
          ? IDENTITY
          : zoomBy(
              viewRef.current,
              action === "in" ? ZOOM_STEP : 1 / ZOOM_STEP,
              latest.current.size,
            ),
      );
      announce();
    },
    [announce, commit],
  );

  // Ctrl+wheel must cancel the browser's own page zoom: a passive listener
  // (React's) cannot.
  React.useEffect(() => {
    const element = surface.current as HTMLDivElement;
    let settled: ReturnType<typeof setTimeout> | undefined;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      const focal = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
      const current = viewRef.current;
      commit(
        zoomAt(
          current,
          current.scale * wheelFactor(event.deltaY, event.deltaMode),
          focal,
          latest.current.size,
        ),
      );
      clearTimeout(settled);
      settled = setTimeout(announce, 400);
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      clearTimeout(settled);
      element.removeEventListener("wheel", onWheel);
    };
  }, [announce, commit]);

  // The viewer is modal, so its keys are the page's while it is open (and
  // not while it closes).
  React.useEffect(() => {
    if (!active) return;
    const target = (surface.current as HTMLDivElement).ownerDocument;
    const onKey = (event: KeyboardEvent) => {
      // The dialog holds no text field, so the keys are free to take.
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.isComposing || event.defaultPrevented) return;
      const action = zoomKey(event.key);
      if (action) {
        event.preventDefault();
        zoom(action);
        return;
      }
      const delta = arrowPan(event.key);
      if (!delta) return;
      const current = viewRef.current;
      if (current.scale > MIN_SCALE) {
        event.preventDefault();
        commit(panBy(current, delta, latest.current.size));
      } else if (delta.x !== 0) {
        event.preventDefault();
        latest.current.onSwipe?.(delta.x > 0 ? "previous" : "next");
      }
    };
    target.addEventListener("keydown", onKey);
    return () => target.removeEventListener("keydown", onKey);
  }, [active, commit, zoom]);

  const pointOf = (event: React.PointerEvent): Point => {
    const rect = (surface.current as HTMLDivElement).getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  /** Starts the gesture's next phase from the fingers now down (one or more). */
  const begin = () => {
    const [a, b] = pointers.current.values();
    const start = viewRef.current;
    if (b) {
      multi.current = true;
      gesture.current = { kind: "pinch", start, from: [a, b] };
    } else gesture.current = { kind: "drag", start, from: a, moved: false };
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    if (pointers.current.size === 0) multi.current = false;
    pointers.current.set(event.pointerId, pointOf(event));
    begin();
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, pointOf(event));
    // Set whenever a finger is down.
    const current = gesture.current as Gesture;
    const { size } = latest.current;
    if (current.kind === "pinch") {
      const [a, b] = pointers.current.values() as Iterator<Point> &
        Iterable<Point>;
      commit(pinch(current.start, current.from, [a, b], size));
      return;
    }
    const point = pointers.current.get(event.pointerId) as Point;
    const delta = { x: point.x - current.from.x, y: point.y - current.from.y };
    if (Math.hypot(delta.x, delta.y) > TAP_DISTANCE) current.moved = true;
    if (current.start.scale > MIN_SCALE)
      commit(panBy(current.start, delta, size));
  };

  const onPointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    const point = pointers.current.get(event.pointerId);
    if (!point) return;
    pointers.current.delete(event.pointerId);
    const current = gesture.current;
    if (pointers.current.size > 0) {
      begin();
      return;
    }
    gesture.current = null;
    announce();
    if (current?.kind !== "drag" || multi.current) return;
    if (event.type === "pointercancel") return;
    const delta = { x: point.x - current.from.x, y: point.y - current.from.y };
    if (!current.moved) {
      const tap = { ...point, time: event.timeStamp };
      if (isDoubleTap(lastTap.current, tap)) {
        lastTap.current = null;
        commit(IDENTITY);
        announce();
      } else lastTap.current = tap;
      return;
    }
    lastTap.current = null;
    if (current.start.scale > MIN_SCALE) return;
    const direction = swipeDirection(delta);
    if (direction) latest.current.onSwipe?.(direction);
  };

  // Unmeasured (as in a test), the drawing takes the surface's width.
  const fitted =
    measured.width > 0 && measured.height > 0 ? size.drawing.width : null;
  const zoomed = view.scale > MIN_SCALE;

  return (
    <Box
      ref={surface}
      role="group"
      aria-label={label}
      data-scale={view.scale}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      sx={{
        position: "relative",
        flex: 1,
        minHeight: 0,
        overflow: "hidden",
        touchAction: "none",
        userSelect: "none",
        cursor: zoomed ? "grab" : "default",
        background: "#fff",
      }}
    >
      <Box
        data-testid="hall-pan-zoom-content"
        style={{
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
        }}
        sx={{
          position: "absolute",
          inset: 0,
          transformOrigin: "0 0",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Box
          sx={{
            width: fitted === null ? "100%" : `${fitted}px`,
            "& > figure": { margin: 0, maxWidth: "none" },
          }}
        >
          {children}
        </Box>
      </Box>
      {!zoomed && (
        <Box
          aria-hidden="true"
          sx={{
            position: "absolute",
            top: 12,
            left: "50%",
            transform: "translateX(-50%)",
            px: 1.25,
            py: 0.25,
            borderRadius: 4,
            background: "rgba(0, 0, 0, 0.6)",
            color: "#fff",
            fontSize: "0.8125rem",
            pointerEvents: "none",
            whiteSpace: "nowrap",
          }}
        >
          Pinch or Ctrl+scroll to zoom
        </Box>
      )}
      <Paper
        elevation={2}
        // Taps on the buttons are not the drawing's.
        onPointerDown={(event) => event.stopPropagation()}
        sx={{
          position: "absolute",
          right: 8,
          bottom: 8,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <IconButton
          aria-label="Zoom in"
          disabled={view.scale >= MAX_SCALE}
          onClick={() => zoom("in")}
        >
          <AddIcon />
        </IconButton>
        <IconButton
          aria-label="Zoom out"
          disabled={!zoomed}
          onClick={() => zoom("out")}
        >
          <RemoveIcon />
        </IconButton>
        <IconButton
          aria-label="Reset zoom"
          disabled={!zoomed && view.x === 0 && view.y === 0}
          onClick={() => zoom("reset")}
        >
          <RestartAltIcon />
        </IconButton>
      </Paper>
      <Box
        aria-live="polite"
        sx={{
          position: "absolute",
          width: 1,
          height: 1,
          overflow: "hidden",
          clip: "rect(0 0 0 0)",
        }}
      >
        {`Zoom ${Math.round(announced * 100)}%`}
      </Box>
    </Box>
  );
}
