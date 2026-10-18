import { HALL_PRESETS } from "@magick-components/gd/hall/presets";
import type { HallAttrSpec } from "@magick-components/gd/hall/types";
import { describe, expect, it } from "vitest";
import { gdHallArt } from "@/app/gd/hall/art";
import { gdHallSource } from "../gdHallRows";
import { isRitualNodeId } from "../ritualNodeIds";
import { parseRitualPug, printRitualPug } from "../ritualPug";
import {
  type JsonValue,
  type RitualSemanticDocument,
  validateRitualSemantic,
} from "../semantic";
import { hallNodeSpec } from "./HallProperties";
import {
  deleteNode,
  dragScaleNode,
  duplicateNode,
  type HallView,
  hallView,
  moveNode,
  nudgeNode,
  setNodeAttr,
  stepScaleNode,
} from "./hallEdits";
import { type HallElement, normalizeHall } from "./hallModel";
import { hallPalette, insertFromPalette } from "./hallPalette";
import { sequentialIds } from "./hallTestFixtures";

/**
 * Random editor operations on every preset (plan 061, decision 11): after
 * each one, as the editor writes it back, the hall is valid ritual source
 * and round-trips through Pug exactly, with unique valid IDs and no `-0`.
 */

/** A small seeded generator (mulberry32), so a failure can be replayed. */
function random(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const STRINGS = [
  "Hegemon",
  "",
  'He said "go"',
  "back\\slash",
  "line separator",
  "two\nlines",
  "#id(like)=pug",
  "Ἱεροφάντης",
  "קדש",
  "🜂 fire",
  "  spaced  ",
];

const palette = hallPalette(gdHallArt);

function valueFor(spec: HallAttrSpec, next: () => number): JsonValue {
  const pick = <T>(list: readonly T[]) =>
    list[Math.floor(next() * list.length)];
  switch (spec.kind) {
    case "number": {
      const min = spec.min ?? -100;
      const max = spec.max ?? 100;
      const value = min + next() * (max - min);
      return spec.integer ? Math.round(value) : Math.round(value * 100) / 100;
    }
    case "enum":
      return pick(spec.values);
    case "boolean":
      return next() < 0.5;
    case "string":
      return pick(STRINGS);
  }
}

type Operation = (view: HallView, next: () => number) => HallElement;

function operations(createId: () => string): Operation[] {
  const target = (view: HallView, next: () => number) =>
    view.selectables[Math.floor(next() * view.selectables.length)];
  const delta = (next: () => number) => ({
    x: (next() - 0.5) * 8,
    y: (next() - 0.5) * 8,
  });
  return [
    (view, next) => {
      const entry = target(view, next);
      return entry
        ? moveNode(view, entry.id, delta(next), next() < 0.7)
        : view.hall;
    },
    (view, next) => {
      const entry = target(view, next);
      const step = next() < 0.5 ? 0.5 : 1;
      return entry
        ? nudgeNode(view, entry.id, {
            x: next() < 0.5 ? step : -step,
            y: next() < 0.5 ? 0 : -step,
          })
        : view.hall;
    },
    (view, next) => {
      const entry = target(view, next);
      const object = entry?.object;
      if (!entry || !object) return view.hall;
      return dragScaleNode(
        view,
        entry.id,
        { x: object.cx + 1, y: object.cy + 1 },
        { x: object.cx + next() * 3, y: object.cy + next() * 3 },
      );
    },
    (view, next) => {
      const entry = target(view, next);
      return entry ? stepScaleNode(view, entry.id, next() < 0.5) : view.hall;
    },
    (view, next) => {
      const entry = target(view, next);
      // Deleting is rarer, so halls keep something to edit.
      return entry && next() < 0.4 ? deleteNode(view, entry.id) : view.hall;
    },
    (view, next) => {
      const entry = target(view, next);
      return (
        (entry && duplicateNode(view, entry.id, createId)?.hall) ?? view.hall
      );
    },
    (view, next) => {
      if (!view.resolved) return view.hall;
      const entry = palette[Math.floor(next() * palette.length)];
      const selected = next() < 0.5 ? target(view, next)?.id : undefined;
      return insertFromPalette(
        view.hall,
        view.resolved,
        entry,
        selected,
        createId,
      ).hall;
    },
    (view, next) => {
      const entry = next() < 0.85 ? target(view, next) : undefined;
      const node = entry?.node ?? view.hall;
      const specs = [...hallNodeSpec(node, gdHallArt)];
      if (specs.length === 0) return view.hall;
      const [name, spec] = specs[Math.floor(next() * specs.length)];
      return setNodeAttr(
        view,
        node.id,
        name,
        next() < 0.15 ? undefined : valueFor(spec, next),
      );
    },
  ];
}

const document = (hall: HallElement): RitualSemanticDocument => ({
  format: "magickli-ritual",
  version: 1,
  nodes: [hall],
});

function check(hall: HallElement, context: string) {
  const doc = document(hall);
  expect(validateRitualSemantic(doc), context).toEqual([]);
  const printed = printRitualPug(doc);
  const parsed = parseRitualPug(printed);
  expect(parsed, context).toEqual(doc);
  expect(printRitualPug(parsed), context).toBe(printed);
  const seen = new Set<string>();
  const walk = (node: HallElement) => {
    expect(isRitualNodeId(node.id), context).toBe(true);
    expect(seen.has(node.id), context).toBe(false);
    seen.add(node.id);
    for (const value of Object.values(node.attrs))
      if (typeof value === "number") {
        expect(Number.isFinite(value), context).toBe(true);
        expect(Object.is(value, -0), context).toBe(false);
      }
    for (const child of node.children ?? [])
      if (child.kind === "element") walk(child);
  };
  walk(hall);
}

describe.each(HALL_PRESETS.map((preset) => [preset.id, preset] as const))(
  "random editor operations on the %s preset",
  (id, preset) => {
    it("keep the hall valid and exact through Pug", () => {
      const createId = sequentialIds("R");
      const steps = operations(createId);
      let hall = normalizeHall(gdHallSource(preset.hall, createId), gdHallArt);
      check(hall, `${id} as inserted`);
      const next = random(
        [...id].reduce((sum, c) => sum * 31 + c.charCodeAt(0), 7),
      );
      for (let step = 0; step < 120; step++) {
        const choice = Math.floor(next() * steps.length);
        const changed = steps[choice](hallView(hall, gdHallArt), next);
        if (changed === hall) continue;
        hall = normalizeHall(changed, gdHallArt);
        check(hall, `${id}, step ${step}, operation ${choice}`);
      }
    });
  },
);
