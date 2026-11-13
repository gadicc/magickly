/**
 * The rose sigil's layout optimiser, nlopt's COBYLA compiled to WASM
 * (`nlopt-js`). It is a module of its own so that only what runs it, the
 * live `RoseSigil` and a server renderer, brings nlopt into a bundle:
 * `RoseSigilImage` and the geometry never import it (plan 080, decision 7).
 * In a browser bundle nlopt's Emscripten glue asks for Node's `fs`, which
 * the bundler must stub out; the README says how.
 */
import {
  arrayToPoints,
  objective,
  type Point,
  pointsToArray,
  SIGIL_MAX_EVALUATIONS,
} from "./roseSigilGeometry.ts";

type NloptModule = {
  ready: Promise<unknown>;
  Algorithm: { LN_COBYLA: number };
  Optimize: new (
    algorithm: number,
    dimensions: number,
  ) => {
    setMaxObjective(
      objective: (x: number[]) => number,
      tolerance: number,
    ): void;
    setMaxeval(count: number): void;
    optimize(start: number[]): { x: number[] };
  };
  GC: { flush(): void };
};
type ProcessEvent = "unhandledRejection" | "uncaughtException";
let nloptModule: Promise<NloptModule> | undefined;

/**
 * Loads the optimiser once per runtime. Its Emscripten glue registers
 * process-wide abort handlers on load in Node, which would replace every
 * later server diagnostic with a WASM abort message; remove exactly those.
 */
async function loadNlopt(): Promise<NloptModule> {
  const node =
    typeof process === "object" && typeof process.listeners === "function"
      ? (process as NodeJS.EventEmitter)
      : null;
  const events: ProcessEvent[] = ["unhandledRejection", "uncaughtException"];
  const before = new Map(
    events.map((event) => [event, new Set(node?.listeners(event) ?? [])]),
  );
  // The bundler's namespace for this CommonJS module is a snapshot taken before
  // `ready` attaches the classes, so always go through the live default export.
  const nlopt = (await import("nlopt-js")).default as NloptModule;
  await nlopt.ready;
  if (node)
    for (const event of events)
      for (const listener of node.listeners(event))
        if (!before.get(event)?.has(listener))
          node.removeListener(event, listener as (...args: unknown[]) => void);
  return nlopt;
}

/**
 * Spreads the connecting path with COBYLA so repeated and collinear letters
 * stay readable. Bounded by evaluations, never by wall-clock time, so the
 * browser and the server converge on the same layout.
 */
export async function optimizeSigilPoints(points: Point[]): Promise<Point[]> {
  if (points.length === 0) return [];
  let nlopt: NloptModule;
  try {
    nlopt = await (nloptModule ??= loadNlopt());
  } catch (error) {
    nloptModule = undefined;
    throw error;
  }
  const opt = new nlopt.Optimize(nlopt.Algorithm.LN_COBYLA, 2 * points.length);
  try {
    opt.setMaxObjective(objective.bind(null, points), 1e-4);
    opt.setMaxeval(SIGIL_MAX_EVALUATIONS);
    const result = opt.optimize(pointsToArray(points));
    return arrayToPoints(result.x);
  } finally {
    nlopt.GC.flush();
  }
}
