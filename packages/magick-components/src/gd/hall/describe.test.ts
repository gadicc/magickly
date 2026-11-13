import { describe, expect, it } from "vitest";
import { describeHall, type HallDescription, hallObjectName } from "./describe";
import { HALL_PRESETS } from "./presets";

/** A description as lines, so a change reads as a diff of lines. */
function lines(description: HallDescription) {
  return {
    officers: description.officers.map((o) => `${o.name}: ${o.where}`),
    altars: description.altars.map(
      (a) => `${a.name} (${a.where}): ${a.items.join(", ")}`,
    ),
    furniture: description.furniture.map((o) => `${o.name}: ${o.where}`),
  };
}

/**
 * Every preset in words, pinned after reading each against its preset's
 * doc comment (plan 062, decision 9): a change to the generator or to a
 * preset shows here as lines to review.
 */
const EXPECTED: Record<string, ReturnType<typeof lines>> = {
  neophyte: {
    officers: [
      "Hegemon: in the East",
      "Stolistes: in the North",
      "Dadouchos: in the South",
      "Hiereus: in the West",
      "Keryx: by the West wall",
      "Sentinel: beyond the West wall",
      "Imperator: on the dais",
      "Cancellarius: on the dais",
      "Hierophant: on the dais",
      "Past Hierophant: on the dais",
      "Praemonstrator: on the dais",
    ],
    altars: [
      "altar (in the centre): cross, triangle, rose, salt, bread, red lamp, cup",
    ],
    furniture: [
      "Banner of the East: on the dais",
      "black pillar: in the North-East",
      "white pillar: in the South-East",
      "platform: in the West",
      "Banner of the West: in the North-West",
    ],
  },
  zelator1: {
    officers: [
      "Hiereus: North of the altar",
      "Hegemon: South of the altar",
      "Stolistes: in the North-West",
      "Keryx: in the West",
      "Dadouchos: in the South-West",
      "Imperator: on the dais",
      "Cancellarius: on the dais",
      "Hierophant: on the dais",
      "Past Hierophant: on the dais",
      "Praemonstrator: on the dais",
    ],
    altars: ["altar (in the centre): red lamp, Flaming Sword, triangle, cross"],
    furniture: [
      "Banner of the West: on the dais",
      "Banner of the East: on the dais",
      "Earth tablet: by the North wall",
      "yellow lantern: by the North wall",
      "salt: by the North wall",
      "black pillar: in the North-West",
      "white pillar: in the South-West",
      "Shin (ש): beyond the East wall",
      "Tau (ת): beyond the East wall",
      "Qoph (ק): beyond the East wall",
    ],
  },
  zelator2: {
    officers: [
      "Hegemon: in the centre",
      "Hiereus: in the West",
      "Stolistes: in the North-West",
      "Dadouchos: in the South-West",
      "Keryx: in the West",
      "Imperator: on the dais",
      "Cancellarius: on the dais",
      "Hierophant: on the dais",
      "Past Hierophant: on the dais",
      "Praemonstrator: on the dais",
    ],
    altars: [
      "altar (in the East): triangle, cross, censer, chalice, yellow lantern",
    ],
    furniture: [
      "Banner of the West: on the dais",
      "Banner of the East: on the dais",
      "Earth tablet: by the North wall",
      "yellow lantern: by the North wall",
      "salt: by the North wall",
      "Table of Shewbread: in the North",
      "Seven-Branched Candlestick: in the South",
      "black pillar: in the North-West",
      "white pillar: in the South-West",
      "Shin (ש): beyond the East wall",
      "Tau (ת): beyond the East wall",
      "Qoph (ק): beyond the East wall",
    ],
  },
  theoricus1: {
    officers: [
      "Keryx: in the North",
      "Hegemon: by the South wall",
      "Hiereus: in the West",
      "Imperator: on the dais",
      "Cancellarius: on the dais",
      "Hierophant: on the dais",
      "Past Hierophant: on the dais",
      "Praemonstrator: on the dais",
    ],
    altars: [
      "altar (in the centre): The Universe (XXI), fan, salt, yellow lantern, cup",
    ],
    furniture: [
      "Air tablet: in the East",
      "Banner of the West: on the dais",
      "Banner of the East: on the dais",
      "yellow lantern: in the East",
      "Pantacle: in the East",
      "black pillar: in the North-East",
      "white pillar: in the South-East",
      "Shin (ש): beyond the East wall",
      "Tau (ת): beyond the East wall",
      "Qoph (ק): beyond the East wall",
    ],
  },
  theoricus2: {
    officers: [
      "Keryx: in the North",
      "Hegemon: in the South",
      "Hiereus: in the West",
      "Imperator: on the dais",
      "Cancellarius: on the dais",
      "Hierophant: on the dais",
      "Past Hierophant: on the dais",
      "Praemonstrator: on the dais",
    ],
    altars: ["altar (in the centre): triangle, cross, cup, red lamp"],
    furniture: [
      "Air tablet: in the East",
      "Banner of the East: on the dais",
      "kamea of the Moon: in the North-East",
      "seals of the Moon: in the South-East",
      "yellow lantern: in the East",
      "Pantacle: in the East",
      "Serpent on the Tree: East of the altar",
      "black pillar: North of the altar",
      "Flaming Sword: West of the altar",
      "white pillar: South of the altar",
      "Banner of the West: in the West",
      "Resh (ר): beyond the East wall",
      "Samekh (ס): beyond the East wall",
      "Tzaddi (צ): beyond the East wall",
      "Tau (ת): beyond the West wall",
    ],
  },
  practicus1: {
    officers: [
      "Hiereus: by the West wall",
      "Hegemon: by the West wall",
      "Hierophant: on the dais",
    ],
    altars: ["altar (in the centre): Judgement (XX)"],
    furniture: [
      "black pillar: in the North-East",
      "white pillar: in the North-East",
      "candle: North of the altar",
      "candle: South of the altar",
      "censer: in the South",
      "Seat for the Theoricus: in the North-West",
      "Banner of the West: in the West",
      "red lamp: by the West wall",
      "cup: by the West wall",
      "red lamp: by the West wall",
      "Shin (ש): beyond the East wall",
      "red lamp: on the dais",
      "Banner of the East: on the dais",
    ],
  },
  practicus2: {
    officers: [
      "Hiereus: by the West wall",
      "Hegemon: by the West wall",
      "Hierophant: on the dais",
    ],
    altars: ["altar (in the centre): The Sun (XIX)"],
    furniture: [
      "black pillar: in the North-East",
      "white pillar: in the North-East",
      "candle: North of the altar",
      "candle: South of the altar",
      "censer: in the South",
      "Seat for the Theoricus: in the North-West",
      "Banner of the West: in the West",
      "red lamp: by the West wall",
      "cup: by the West wall",
      "red lamp: by the West wall",
      "Resh (ר): beyond the East wall",
      "red lamp: on the dais",
      "Banner of the East: on the dais",
    ],
  },
  practicus3: {
    officers: [
      "Hiereus: in the North",
      "Hegemon: in the South",
      "Hierophant: West of the altar",
    ],
    altars: [
      "altar (in the centre): cross, cup, triangle, red lamp, red lamp, red lamp",
    ],
    furniture: [
      "The Garden of Eden: East of the altar",
      "black pillar: North of the altar",
      "white pillar: South of the altar",
      "Banner of the West: in the West",
      "cup: in the West",
      "Mem (מ): beyond the East wall",
      "Mercury: on the dais",
      "throne: on the dais",
      "Banner of the East: on the dais",
      "Ayin (ע): beyond the South wall",
      "Peh (פ): beyond the South wall",
      "Shin (ש): beyond the West wall",
      "Resh (ר): beyond the West wall",
    ],
  },
  philosophus1: {
    officers: [
      "Hierophant: in the North-East",
      "Hegemon: in the South-East",
      "Hiereus: in the West",
    ],
    altars: ["altar (in the centre): The Moon (XVIII)"],
    furniture: [
      "cup: by the North wall",
      "Banner of the East: in the East",
      "cup: in the South-East",
      "black pillar: in the South-East",
      "white pillar: in the South-East",
      "Fire tablet: by the South wall",
      "red lamp: in the South",
      "censer: in the South",
      "candle: North of the altar",
      "candle: South of the altar",
      "Banner of the West: in the West",
      "cup: in the West",
      "red lamp: in the South-West",
      "Shin (ש): beyond the East wall",
      "Tau (ת): beyond the East wall",
      "Qoph (ק): beyond the East wall",
    ],
  },
  philosophus2: {
    officers: [
      "Hierophant: in the North-East",
      "Hegemon: in the South-East",
      "Hiereus: in the West",
    ],
    altars: ["altar (in the centre): The Star (XVII)"],
    furniture: [
      "cup: by the North wall",
      "Banner of the East: in the East",
      "cup: in the South-East",
      "black pillar: in the South-East",
      "white pillar: in the South-East",
      "Fire tablet: by the South wall",
      "red lamp: in the South",
      "censer: in the South",
      "candle: North of the altar",
      "candle: South of the altar",
      "Banner of the West: in the West",
      "cup: in the West",
      "red lamp: in the South-West",
      "Resh (ר): beyond the East wall",
      "Samekh (ס): beyond the East wall",
      "Tzaddi (צ): beyond the East wall",
    ],
  },
  philosophus3: {
    officers: [
      "Hiereus: in the North-East",
      "Hegemon: in the South-East",
      "Hierophant: on the dais",
    ],
    altars: ["altar (in the centre): The Tower (XVI)"],
    furniture: [
      "Banner of the West: by the North wall",
      "red lamp: in the North-East",
      "Banner of the East: in the East",
      "red lamp: in the South-East",
      "white pillar: in the South",
      "Fire tablet: by the South wall",
      "red lamp: in the South",
      "censer: in the South",
      "black pillar: in the South",
      "candle: North of the altar",
      "candle: South of the altar",
      "Mem (מ): beyond the East wall",
      "red lamp: on the dais",
      "Ayin (ע): beyond the South wall",
      "Peh (פ): beyond the South wall",
      "Resh (ר): beyond the South wall",
      "Shin (ש): beyond the West wall",
    ],
  },
  philosophus4: {
    officers: [
      "Hiereus: in the North",
      "Hegemon: in the South",
      "Hierophant: on the dais",
    ],
    altars: [
      "altar (in the centre): triangle, cross, red lamp, red lamp, red lamp",
    ],
    furniture: [
      "The Fall: East of the altar",
      "black pillar: North of the altar",
      "white pillar: South of the altar",
      "Fire tablet: by the South wall",
      "red lamp: in the South",
      "censer: in the South",
      "Banner of the West: in the West",
      "Kaph (כ): beyond the East wall",
      "kamea of Venus: on the dais",
      "seals of Venus: on the dais",
      "Banner of the East: on the dais",
      "Venus on the Tree of Life: on the dais",
      "Nun (נ): beyond the North wall",
      "Peh (פ): beyond the North wall",
      "Tzaddi (צ): beyond the North wall",
      "Qoph (ק): beyond the West wall",
    ],
  },
  portal1: {
    officers: [
      "Third Adept: in the North-East",
      "Second Adept: in the South-East",
      "Hegemon: East of the altar",
      "Hiereus: in the West",
      "Chief Adept: on the dais",
    ],
    altars: ["altar (in the centre): cross", "white altar (on the dais): "],
    furniture: [
      "Mem (מ): in the North-East",
      "Ayin (ע): in the North-East",
      "Samekh (ס): in the East",
      "Nun (נ): in the South-East",
      "Kaph (כ): in the South-East",
      "cup: in the North-East",
      "Banner of the East: in the North-East",
      "Air tablet: in the East",
      "censer: in the South-East",
      "rose: in the centre",
      "Earth tablet: by the North wall",
      "Fire tablet: by the South wall",
      "salt: in the West",
      "Banner of the West: in the North-West",
      "Water tablet: by the West wall",
      "Tablet of Union: beyond the East wall",
      "gong: beyond the East wall",
      "brazier: on the dais",
      "white lamp: on the dais",
      "censer: on the dais",
      "black pillar: on the dais",
      "white pillar: on the dais",
      "veil: on the dais",
    ],
  },
  portal2: {
    officers: [
      "Hegemon: West of the altar",
      "Hiereus: in the West",
      "Third Adept: on the dais",
      "Chief Adept: on the dais",
      "Second Adept: on the dais",
    ],
    altars: [
      "altar (in the centre): pentagram, cross, rose, salt, censer, cup",
      "white altar (on the dais): ",
    ],
    furniture: [
      "Mem (מ): in the North-East",
      "Ayin (ע): in the North-East",
      "Samekh (ס): in the East",
      "Nun (נ): in the South-East",
      "Kaph (כ): in the South-East",
      "Banner of the East: in the North-East",
      "Air tablet: in the East",
      "Pan: in the North-East",
      "The Devil: in the North-West",
      "Death: in the South-East",
      "Typhon: in the South-West",
      "Earth tablet: by the North wall",
      "Fire tablet: by the South wall",
      "Banner of the West: in the North-West",
      "Water tablet: in the South-West",
      "black pillar: on the dais",
      "white pillar: on the dais",
      "veil: on the dais",
      "Tau (ת): beyond the West wall",
    ],
  },
};

describe("describeHall", () => {
  it.each(HALL_PRESETS.map((preset) => [preset.id, preset] as const))(
    "describes %s",
    (id, preset) => {
      expect(lines(describeHall(preset.hall))).toEqual(EXPECTED[id]);
    },
  );

  it("names what it describes and nothing else", () => {
    expect(hallObjectName({ type: "item", kind: "lamp" })).toBe("red lamp");
    expect(hallObjectName({ type: "item", kind: "lantern" })).toBe(
      "yellow lantern",
    );
    expect(hallObjectName({ type: "item", kind: "lamp", light: "white" })).toBe(
      "white lamp",
    );
    expect(hallObjectName({ type: "item", kind: "serpentTree" })).toBe(
      "serpent tree",
    );
    expect(hallObjectName({ type: "hebrewLetter", letter: "ש" })).toBe(
      "the letter ש",
    );
    expect(hallObjectName({ type: "hebrewLetter", letter: "nope" })).toBe(
      "Hebrew letter",
    );
    expect(hallObjectName({ type: "tarotKey", n: 99 })).toBe("tarot key");
    expect(hallObjectName({ type: "tablet", element: "nope" })).toBe(
      "Enochian tablet",
    );
    expect(hallObjectName({ type: "kamea", planet: "pluto" })).toBe(
      "kamea of a planet",
    );
    expect(hallObjectName({ type: "marker", text: "  " })).toBe("marker");
    expect(hallObjectName({ type: "banner", kind: "north" })).toBe("banner");
    for (const type of ["label", "door", "caption", "floor", "dais", "banners"])
      expect(hallObjectName({ type })).toBeUndefined();
  });

  it("describes anything but a hall as an empty one", () => {
    expect(describeHall({ type: "gdHall" })).toEqual({
      officers: [],
      altars: [],
      furniture: [],
    });
  });
});
