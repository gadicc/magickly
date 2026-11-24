import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-wasm";
import {
  type DrawnSigilStyle,
  StyledRoseSigilImage,
  styledRoseSigilLayout,
} from "magick-components/gd/roseSigilStyles";
import angels from "magick-data/kabbalah/seventyTwoAngels";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
// The measured metrics the package lays the lettering out with; not a
// package entry.
import fontMetrics from "../../packages/magick-components/src/gd/hall/fontMetrics.json";

vi.mock("server-only", () => ({}));

import {
  ANGEL_SIGIL_FONTS,
  ANGEL_SIGIL_IMAGE_PROFILE,
  angelSigilInput,
  angelSigilLegend,
  renderAngelSigilImage,
} from "./angelSigilImage";
import { renderComponentImage } from "./componentImage";
import { ANGEL_SIGIL_SLUGS, type AngelSigilSlug } from "./contracts/angelSigil";
import { outlineComponentImage, roundOutlinedPaths } from "./outlineTreeImage";
import { componentInputsHash } from "./registry";

const DRAWN: readonly DrawnSigilStyle[] = ["band", "bare", "talisman"];
const sha256 = (value: string | Uint8Array) =>
  createHash("sha256").update(value).digest("hex");

/** The subset each lettering run is set in (`SIGIL_STYLE_FONTS`). */
const FACE_FILES = {
  roman: "NotoSerif-Regular-latin1.ttf",
  hebrew: "FrankRuhlLibre-Bold-letters.ttf",
} as const;
const fontBytes = (file: string) => readFileSync(`assets/fonts/${file}`);

/** The characters a TrueType font maps (cmap formats 4 and 12). */
function cmapCharacters(bytes: Buffer): Set<number> {
  let cmap = -1;
  for (let i = 0; i < bytes.readUInt16BE(4); i++) {
    const at = 12 + 16 * i;
    if (bytes.toString("latin1", at, at + 4) === "cmap")
      cmap = bytes.readUInt32BE(at + 8);
  }
  if (cmap < 0) throw new Error("no cmap");
  const mapped = new Set<number>();
  for (let i = 0; i < bytes.readUInt16BE(cmap + 2); i++) {
    const record = cmap + 4 + 8 * i;
    const table = cmap + bytes.readUInt32BE(record + 4);
    const format = bytes.readUInt16BE(table);
    if (format === 4) {
      const segments = bytes.readUInt16BE(table + 6) / 2;
      const ends = table + 14;
      const starts = ends + 2 * segments + 2;
      const deltas = starts + 2 * segments;
      const offsets = deltas + 2 * segments;
      for (let s = 0; s < segments; s++) {
        const end = bytes.readUInt16BE(ends + 2 * s);
        const start = bytes.readUInt16BE(starts + 2 * s);
        const delta = bytes.readInt16BE(deltas + 2 * s);
        const offset = bytes.readUInt16BE(offsets + 2 * s);
        for (let c = start; c <= end && c !== 0xffff; c++) {
          const glyph =
            offset === 0
              ? (c + delta) & 0xffff
              : bytes.readUInt16BE(offsets + 2 * s + offset + 2 * (c - start));
          if (glyph !== 0) mapped.add(c);
        }
      }
    } else if (format === 12) {
      for (let g = 0; g < bytes.readUInt32BE(table + 12); g++) {
        const group = table + 16 + 12 * g;
        const glyph = bytes.readUInt32BE(group + 8);
        for (
          let c = bytes.readUInt32BE(group);
          c <= bytes.readUInt32BE(group + 4);
          c++
        )
          if (glyph + c - bytes.readUInt32BE(group) !== 0) mapped.add(c);
      }
    }
  }
  return mapped;
}

/** The characters a metrics table measures. */
const measured = (table: { advances: number[] }) =>
  new Set(table.advances.filter((_, i) => i % 2 === 0));

/** Every outline's path data in an SVG, in order. */
const pathData = (svg: string) =>
  [...svg.matchAll(/ d="([^"]*)"/g)].map(([, d]) => d);

describe("the angels' sigil styles (plan 096)", () => {
  it("publishes under a profile of its own, with the styles' faces", async () => {
    expect(ANGEL_SIGIL_IMAGE_PROFILE).toBe("magickli-angel-sigil-image-v2");
    expect([...ANGEL_SIGIL_FONTS]).toEqual([
      FACE_FILES.roman,
      FACE_FILES.hebrew,
    ]);
    const image = await renderComponentImage(
      "angel-sigil",
      new URLSearchParams("angel=vehuiah"),
    );
    expect(image.identity.profile).toBe(ANGEL_SIGIL_IMAGE_PROFILE);
    expect(image.identity.fonts.map((font) => font.file).slice(-2)).toEqual([
      ...ANGEL_SIGIL_FONTS,
    ]);
  });

  it("letters each genius's Latin verse, and Jabamiah's Genesis 1:1", () => {
    for (const [index, slug] of ANGEL_SIGIL_SLUGS.entries())
      if (slug !== "jabamiah")
        expect(angelSigilLegend(slug)).toBe(angels[index].psalm.la);
    expect(angelSigilLegend("jabamiah")).toBe(
      "In principio creavit Deus cælum et terram.",
    );
    expect(angelSigilInput("sitael", "band")).toEqual({
      text: "סיטאל",
      sigilStyle: "band",
      roman: "Sitaël",
    });
    expect(angelSigilInput("jabamiah", "talisman")).toMatchObject({
      text: "יבמיה",
      legend: "In principio creavit Deus cælum et terram.",
    });
    // The rose is rose-sigil's: never drawn here.
    expect(() =>
      renderAngelSigilImage({ angel: "vehuiah", style: "rose" }),
    ).toThrow(/rose-sigil/);
  });

  it("has every character it letters in the metrics and in each subset", () => {
    const faces = {
      roman: {
        metrics: measured(fontMetrics.roman),
        cmap: cmapCharacters(fontBytes(FACE_FILES.roman)),
      },
      hebrew: {
        metrics: measured(fontMetrics.hebrew),
        cmap: cmapCharacters(fontBytes(FACE_FILES.hebrew)),
      },
    };
    const lettered = { roman: new Set<string>(), hebrew: new Set<string>() };
    for (const slug of ANGEL_SIGIL_SLUGS)
      for (const style of DRAWN)
        for (const run of styledRoseSigilLayout(angelSigilInput(slug, style))
          .lettering)
          for (const character of run.text) {
            lettered[run.font].add(character);
            const point = character.codePointAt(0) as number;
            expect(
              [
                faces[run.font].metrics.has(point),
                faces[run.font].cmap.has(point),
              ],
              `${slug} ${style} ${run.role} “${character}”`,
            ).toEqual([true, true]);
          }
    // The capitals Y0 settled (æ, Æ) and the roman names' accents are
    // among them; the Hebrew is the 22 letters' forms the names use.
    for (const character of "ÆËÏÀÈ-:;,!")
      expect(lettered.roman).toContain(character);
    expect(lettered.hebrew.size).toBeGreaterThanOrEqual(20);
  }, 60_000);

  it("resolves each run's face to its subset, not a fallback", async () => {
    // resvg matches a family's own name, weight and style, and falls back
    // silently (plan 096, Y1: a weight-500 cut is "… Medium"). Each run of
    // the real markup, outlined with the registration's fonts, must draw
    // exactly what its subset alone draws, and not what the base set
    // draws without it.
    const samples: [AngelSigilSlug, DrawnSigilStyle][] = [
      ["vehuiah", "band"],
      ["nith-haiah", "bare"],
      ["asaliah", "talisman"],
      ["mebahiah", "talisman"],
    ];
    const box = [-50, -50, 100, 100] as const;
    const checked = new Set<string>();
    for (const [slug, style] of samples) {
      const markup = renderToStaticMarkup(
        createElement(StyledRoseSigilImage, angelSigilInput(slug, style)),
      );
      const groups = [
        ...markup.matchAll(
          /<g font-family="([^"]*)"[^>]*>(?:<text\b[^>]*>[^<]*<\/text>)*<\/g>/g,
        ),
      ];
      expect(groups.length).toBeGreaterThan(0);
      for (const [group, family] of groups) {
        const run = family === "Noto Serif" ? "roman" : "hebrew";
        expect(family).toBe(
          run === "roman" ? "Noto Serif" : "Frank Ruhl Libre",
        );
        expect(group).toContain(
          run === "roman"
            ? 'font-weight="400" font-style="normal"'
            : 'font-weight="700" font-style="normal"',
        );
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box.join(" ")}">${group}</svg>`;
        const drawn = await outlineComponentImage(svg, {
          profile: ANGEL_SIGIL_IMAGE_PROFILE,
          inputsSha256: "",
          viewBox: box,
          fonts: ANGEL_SIGIL_FONTS,
        });
        const without = await outlineComponentImage(svg, {
          profile: ANGEL_SIGIL_IMAGE_PROFILE,
          inputsSha256: "",
          viewBox: box,
        });
        const alone = new Resvg(svg, {
          font: {
            fontBuffers: [fontBytes(FACE_FILES[run])],
            defaultFontFamily: "none",
          },
        });
        try {
          // Rounded as the outliner rounds every image (`roundOutlinedPaths`),
          // so a fallback face still differs by whole glyphs, not digits.
          const face = pathData(roundOutlinedPaths(alone.toString(), box));
          expect(face.length, `${slug} ${style} ${run}`).toBeGreaterThan(0);
          expect(
            pathData(drawn.bytes.toString()),
            `${slug} ${style} ${run}`,
          ).toEqual(face);
          expect(pathData(without.bytes.toString())).not.toEqual(face);
        } finally {
          alone.free();
        }
        checked.add(run);
      }
    }
    expect([...checked].sort()).toEqual(["hebrew", "roman"]);
  }, 60_000);

  // The styles' reviewed bytes, by the image profile they were reviewed
  // under, as the rose's: a change to the drawing comes with a new profile
  // and a new set, and a shipped profile's drawing never changes. Unlike
  // the rose's pins, these draw the data (an angel's names and verse), so a
  // data fix moves them too. An image is keyed by its data as well as its
  // profile (the inputs hash), so a data fix needs no new profile, only a
  // fresh review. Each set records the inputs hash it was reviewed at, and
  // the test says which of the two moved.
  // Reviewed as rasterised, 23 November 2026.
  const ANGEL_SIGIL_PINS: Record<
    string,
    {
      /** `componentInputsHash("angel-sigil")` when the set was reviewed. */
      inputs: string;
      pins: readonly (readonly [
        query: string,
        byteSize: number,
        sha256: string,
      ])[];
    }
  > = {
    "magickli-angel-sigil-image-v1": {
      inputs:
        "25d38e34e607cd2be8980d1f20fa9363da42358a3d99e7a76af8820ea8404b9a",
      pins: [
        // The default style.
        [
          "angel=vehuiah",
          16_823,
          "ef0a62a59030da3ad36a4dddf998a9cffc96407dd9489aeecb54cd05b02fc79d",
        ],
        // The longest verse (#47).
        [
          "angel=asaliah&style=talisman",
          131_317,
          "19d259b0107010c9685763c4ee76fd7f0f4c65021eeab7a519ddb2a897108feb",
        ],
        // The smallest capitals (#31).
        [
          "angel=lecabel&style=talisman",
          128_306,
          "eb259e4550a408c63418de718b5a48ec4ee68a7667b438c77f51effd3480eff3",
        ],
        // æ, once misread as œ (#43), and Æ (#55).
        [
          "angel=veualiah&style=talisman",
          65_516,
          "28ff770a373286c3e5efc1093ca00a168f6fdf13d85d53b0d03fbcf8e673d521",
        ],
        [
          "angel=mebahiah&style=talisman",
          80_486,
          "8d735fd9c657db366bcc5302b0c73fa03415a950947f7479c455f9039e394eb2",
        ],
        // The longest roman name, hyphened (#25).
        [
          "angel=nith-haiah&style=bare",
          10_241,
          "fa725e88aa3870fcc2f671322e495cc90c5028cfdf84e79513f896f6d4401460",
        ],
        // Genesis 1:1 in the Vulgate's Latin (#70, decision 8).
        [
          "angel=jabamiah&style=talisman",
          50_882,
          "986a6e8920539fe1e60385086fc9ecdd4336255b0eebe10cd41f052caf1dc155",
        ],
      ],
    },
    // Coordinates rounded to OUTLINE_PRECISION (24 November 2026), drawing unchanged.
    "magickli-angel-sigil-image-v2": {
      inputs:
        "25d38e34e607cd2be8980d1f20fa9363da42358a3d99e7a76af8820ea8404b9a",
      pins: [
        // The default style.
        [
          "angel=vehuiah",
          14_490,
          "8f90f624d1291b7ee0cff0a4f333e6353e90378c2ef16c71b5fb6eebb947c641",
        ],
        // The longest verse (#47).
        [
          "angel=asaliah&style=talisman",
          97_660,
          "9039e68d5cb45e7c4d5e72f3f1710f1a081f86a3943ac9bb83cb53d5567c3746",
        ],
        // The smallest capitals (#31).
        [
          "angel=lecabel&style=talisman",
          95_113,
          "b3aaa89e19da693ccc06e9f64c3c5eccfad6e13aef7904c83affbca8578721d4",
        ],
        // æ, once misread as œ (#43), and Æ (#55).
        [
          "angel=veualiah&style=talisman",
          53_953,
          "cd991c736ba86518c795d72f8c4bc0a091fcd452b7966aed26991b5e1051a68d",
        ],
        [
          "angel=mebahiah&style=talisman",
          66_263,
          "fb2bd81135de50d6c1828521e3ff78478988b2c2da271e1e691c9d4dd07381dd",
        ],
        // The longest roman name, hyphened (#25).
        [
          "angel=nith-haiah&style=bare",
          9_364,
          "c5d660016f44c346ab7b41c26ff8ad0b8616e8bc8272a10528e3b364a48a26ab",
        ],
        // Genesis 1:1 in the Vulgate's Latin (#70, decision 8).
        [
          "angel=jabamiah&style=talisman",
          41_548,
          "f31229eaabeb92dbdb17332561a6c1adf15c1e1515bb2854cc101f3439d1460a",
        ],
      ],
    },
  };

  it("pins the styles' reviewed bytes under their image profile", async () => {
    const set = ANGEL_SIGIL_PINS[ANGEL_SIGIL_IMAGE_PROFILE];
    expect(
      set,
      `no reviewed bytes for ${ANGEL_SIGIL_IMAGE_PROFILE}: add its set to ANGEL_SIGIL_PINS`,
    ).toBeDefined();
    const inputs = componentInputsHash("angel-sigil");
    const dataMoved = inputs !== set.inputs;
    for (const [query, byteSize, sha] of set.pins) {
      const image = await renderComponentImage(
        "angel-sigil",
        new URLSearchParams(query),
      );
      expect(
        [image.byteSize, image.sha256],
        dataMoved
          ? `angel-sigil?${query} draws other bytes, and the data it draws changed since the set was reviewed (inputs ${inputs}, reviewed at ${set.inputs}). ` +
              "A data fix keeps the profile: look at the new images rasterised, then re-pin their bytes and this set's inputs " +
              `under ${ANGEL_SIGIL_IMAGE_PROFILE}, with the inputs pin in registry.test.tsx.`
          : `angel-sigil?${query} draws other bytes than ${ANGEL_SIGIL_IMAGE_PROFILE} was reviewed with, from the same data, so the drawing changed. ` +
              "If on purpose, bump ANGEL_SIGIL_IMAGE_PROFILE in angelSigilImage.tsx and pin the reviewed bytes under the new profile; " +
              "never re-pin a shipped profile for a drawing change.",
      ).toEqual([byteSize, sha]);
    }
    // The bytes held, but the data moved: the set no longer says what it
    // was reviewed at.
    expect(
      inputs,
      `the data angel-sigil draws changed but no pinned image did: set this set's inputs to ${inputs}`,
    ).toBe(set.inputs);
  }, 60_000);

  // A digest of the drawing itself, by the same profile: the package
  // component's markup for every genius in each drawn style. The Hebrew,
  // the roman names and the verses are written out as they stood when v1
  // was reviewed (magick-data at 9011e06d, #70 the Vulgate's Genesis 1:1),
  // so that a correction to the data moves the inputs pin above and not
  // this: an image is keyed by its data, so only a change to the drawing
  // should move it.
  const ANGEL_SIGIL_DIGEST_NAMES: readonly (readonly [
    hebrew: string,
    roman: string,
    legend: string,
  ])[] = [
    [
      "והויה",
      "Vehuiah",
      "Et tu Domine susceptor meus et gloria mea et exaltans caput meum",
    ],
    [
      "יליאל",
      "Jeliel",
      "Tu autem Domine ne elongaveris auxilium tuum a me ad defensionem meam conspice",
    ],
    [
      "סיטאל",
      "Sitaël",
      "Dicet Domino : susceptor meus es tu et refugium meum : Deus meus, sperabo in eum.",
    ],
    [
      "עלמיה",
      "Elemiah",
      "Convertere Domine, et eripe animam meam : salvum me fac propter misericordiam tuam.",
    ],
    [
      "מהשיה",
      "Mahasiah",
      "Exquisivi Dominum, et exaudivit me : et ex omnibus tribulationibus meis eripuit me",
    ],
    [
      "ללהאל",
      "Lelahel",
      "Psallite Domino, qui habitat in Sion : annuntiate inter gentes studia ejus.",
    ],
    [
      "אכאיה",
      "Achaiah",
      "Miserator et misericors Dominus : longanimis, et multum misericors.",
    ],
    [
      "כהתאל",
      "Cahethel",
      "Venite adoremus, et procidamus : et ploremus ante Dominum, qui fecit nos.",
    ],
    [
      "הזיאל",
      "Haziel",
      "Reminiscere miserationum tuarum, Domine, et misericordiarum tuarum quæ à sæculo sunt.",
    ],
    [
      "אלדיה",
      "Aladiah",
      "Fiat misericordia tua Domine super nos : quemadmodum speravimus in te.",
    ],
    [
      "לאויה",
      "Lauviah",
      "Vivit Dominus et benedictus Deus meus, et exaltetur Deus salutis meæ.",
    ],
    [
      "ההעיה",
      "Hahaiah",
      "Ut quid Domine recessisti longè, despicis in opportunitatibus, in tribulatione.",
    ],
    [
      "יזלאל",
      "Iezalel",
      "Jubilate Deo omnis terra : cantate, et exultate, et psallite",
    ],
    [
      "מבהאל",
      "Mebahel",
      "Et factus est Dominus refugium pauperi : adjutor in opportunitatibus, in tribulatione.",
    ],
    [
      "הריאל",
      "Hariel",
      "Et factus est mihi Dominus in refugium : et Deus meus in adjutorium spei meæ.",
    ],
    [
      "הקמיה",
      "Hakamiah",
      "Domine Deus salutis meæ, in die clamavi, et nocte coram te.",
    ],
    [
      "לאויה",
      "Lauviah",
      "Domine Dominus noster, quam admirabile est nomen tuum in universâ terrâ!",
    ],
    [
      "כליאל",
      "Caliel",
      "Judica me Domine secundum justitiam meam, et secundum innocentiam meam super me.",
    ],
    ["לוויה", "Leuviah", "Expectans expectavi Dominum, et intendit mihi."],
    [
      "פהליה",
      "Pahaliah",
      "Domine libera animam meam à labiis iniquis, et à linguâ dolosâ.",
    ],
    [
      "נלכאל",
      "Nelchael",
      "Ego autem in te speravi Domine : dixi Deus meus es tu : in manibus tuis sortes meæ.",
    ],
    [
      "יייאל",
      "Ieiaiel",
      "Dominus custodit te; Dominus protectio tua, super manum dexteram tuam.",
    ],
    [
      "מלהאל",
      "Melahel",
      "Dominus custodiat introïtum tuum, et exitum tuum : et ex hoc nunc, et in sæculum.",
    ],
    [
      "ההויה",
      "Hahiuiah",
      "Ecce oculi Domini super metuentes eum : et in eis, qui sperant in misericordia ejus.",
    ],
    [
      "נתהיה",
      "Nith-Haiah",
      "Confitebor tibi Domine in toto corde meo : narrabo omnia mirabilia tua.",
    ],
    [
      "האאיה",
      "Haaiah",
      "Clamavi in toto corde meo, exaudi me Domine; justificationes tuas requiram.",
    ],
    [
      "ירתאל",
      "Ierathel",
      "Eripe me Domine ab homine malo, à viro iniquo eripe me.",
    ],
    [
      "שאהיה",
      "Séheiah",
      "Deus ne elongeris à me : Deus meus in auxilium meum respice.",
    ],
    [
      "רייאל",
      "Reiiel",
      "Ecce enim Deus adjuvat me : et Dominus susceptor est animæ meæ.",
    ],
    [
      "ומאאל",
      "Omael",
      "Quoniam tu es patientia mea Domine : Domine spes mea à juventute mea.",
    ],
    [
      "לכבאל",
      "Lecabel",
      "Quoniam non cognovi litteraturam, introïbo in potentias Domini : Domine memorabor justitiæ tuæ solius.",
    ],
    [
      "ושריה",
      "Vasariah",
      "Quia rectum est verbum Domini, et omnia opera ejus in fide.",
    ],
    [
      "יהויה",
      "Iehuiah",
      "Dominus scit cogitationes hominum quoniam vanæ sunt.",
    ],
    [
      "לההיה",
      "Lehahiah",
      "Speret Israël in Domino; ex hoc nunc, et usque in sæculum.",
    ],
    [
      "כוקיה",
      "Chavakiah",
      "Dilexi quoniam exaudiet Dominus vocem orationis meæ.",
    ],
    [
      "מנדאל",
      "Menadel",
      "Domine dilexi decorem domus tuæ : et locum habitationis gloriæ tuæ.",
    ],
    [
      "אניאל",
      "Aniel",
      "Deus virtutum converte nos : et ostende faciem tuam et salvi erimus.",
    ],
    [
      "העמיה",
      "Haamiah",
      "Quoniam tu es Domine spes mea : altissimum posuisti refugium tuum.",
    ],
    [
      "רהעאל",
      "Rehael",
      "Audivit Dominus, et misertus est mei : Dominus factus est meus adjutor.",
    ],
    [
      "ייזאל",
      "Ieiazel",
      "Ut quid Domine repellis orationem meam : avertis faciem tuam à me.",
    ],
    [
      "הההאל",
      "Hahahel",
      "Domine libera animam meam à labiis iniquis, et à linguâ dolosâ.",
    ],
    [
      "מיכאל",
      "Mikael",
      "Dominus custodit te ab omni malo; custodiat animam tuam Dominus.",
    ],
    [
      "ווליה",
      "Veualiah",
      "Et ego ad te Domine clamavi : et manè oratio mea præveniet te.",
    ],
    [
      "ילהיה",
      "Ielahiah",
      "Voluntaria oris mei bene placita fac Domine : et judicia tua doce me.",
    ],
    [
      "סאליה",
      "Sealiah",
      "Si dicebam, motus est pes meus : misericordia tua Domine adjuvabat me.",
    ],
    [
      "עריאל",
      "Ariel",
      "Suavis Dominus universis : et miserationes ejus super omnia opera ejus.",
    ],
    [
      "עשליה",
      "Asaliah",
      "Quàm magnificata sunt opera tua Domine! omnia in sapientia fecisti : impleta est terra possessione tua.",
    ],
    [
      "מיהאל",
      "Mihael",
      "Notum fecit Dominus salutare suum : in conspectu gentium revelavit justitiam suam.",
    ],
    [
      "והואל",
      "Vehuel",
      "Magnus Dominus et laudabilis nimis et magnitudinis ejus non est finis.",
    ],
    [
      "דניאל",
      "Daniel",
      "Miserator et misericors Dominus : longanimis et misericors.",
    ],
    [
      "ההשיה",
      "Hahasiah",
      "Sit gloria Domini in sæculum : lætabitur Dominus in operibus suis.",
    ],
    [
      "עממיה",
      "Imamiah",
      "Confitebor Domino secundum justitiam ejus : et psallam nomini Domini altissimi.",
    ],
    [
      "ננאאל",
      "Nanael",
      "Cognovi Domine quia æquitas judicia tua : et in veritate tua humiliasti me.",
    ],
    [
      "ניתאל",
      "Nithael",
      "Dominus in cælo paravit sedem suam : et regnum ipsius omnibus dominabitur.",
    ],
    [
      "מבהיה",
      "Mebahiah",
      "Tu autem Domine in æternum permanes : et memoriale tuum in generationem",
    ],
    [
      "פויאל",
      "Poiel",
      "Allevat Dominus omnes qui corruunt : et erigit omnes elisos.",
    ],
    [
      "נממיה",
      "Nemamiah",
      "Qui timent Dominum speraverunt in Domino : adjutor eorum et protector eorum est.",
    ],
    [
      "יילאל",
      "Ieialel",
      "Et anima turbata est valde; sed tu Domine usque quo ?",
    ],
    [
      "הרהאל",
      "Harahel",
      "A solis ortu usque ad occasum, laudabile nomen Domini.",
    ],
    [
      "מצראל",
      "Mitzrael",
      "Justus Dominus in omnibus viis suis : et sanctus in omnibus operibus suis.",
    ],
    [
      "ומבאל",
      "Umabel",
      "Sit nomen Domini benedictum, ex hoc nunc et usque in sæculum.",
    ],
    [
      "יההאל",
      "Iah-hel",
      "Vide quoniam mandata tua dilexi Domine, in misericordiâ tuâ vivifica me.",
    ],
    [
      "ענואל",
      "Anauel",
      "Servite Domino in timore : et exultate ei cum tremore.",
    ],
    [
      "מהיאל",
      "Mehiel",
      "Ecce oculi Domini super metuentes eum : et in eis, qui sperant super misericordia ejus.",
    ],
    [
      "דמביה",
      "Damabiah",
      "Convertere Domine, et usque qua ? et deprecabilis esto super servos tuos.",
    ],
    [
      "מנקאה",
      "Manakel",
      "Ne derelinquas me Domine Deus meus; ne discesseris à me.",
    ],
    [
      "איעאל",
      "Eïael",
      "Delectare in Domino et dabit tibi petitiones cordis tui.",
    ],
    [
      "חבויה",
      "Habuhiah",
      "Confitemini Domino, quoniam bonus : quoniam in sæculum misericordia ejus.",
    ],
    [
      "ראהאל",
      "Rochel",
      "Dominus pars hæreditatis meæ, et calicis mei : tu es, qui restitues hæreditatem meam mihi.",
    ],
    ["יבמיה", "Jabamiah", "In principio creavit Deus cælum et terram."],
    [
      "הייאל",
      "Haiaiel",
      "Confitebor Domino nimis in ore meo : et in medio multorum laudabo eum.",
    ],
    [
      "מומיה",
      "Mumiah",
      "Convertere anima mea in requiem tuam : quia Dominus benefecit tibi.",
    ],
  ];
  const ANGEL_SIGIL_DRAWING_DIGESTS: Record<string, string> = {
    "magickli-angel-sigil-image-v1":
      "9b8355c9d2bae054bc1a057cac4882192252f3491dc9d4b60c9ad542fe9740b1",
    // Coordinates rounded to OUTLINE_PRECISION (24 November 2026), drawing unchanged.
    "magickli-angel-sigil-image-v2":
      "9b8355c9d2bae054bc1a057cac4882192252f3491dc9d4b60c9ad542fe9740b1",
  };

  it("pins a digest of the styles' drawings under their image profile", () => {
    expect(ANGEL_SIGIL_DIGEST_NAMES).toHaveLength(72);
    const drawings = ANGEL_SIGIL_DIGEST_NAMES.flatMap(([text, roman, legend]) =>
      DRAWN.map(
        (sigilStyle) =>
          `${sigilStyle} ${text}\n${renderToStaticMarkup(
            createElement(StyledRoseSigilImage, {
              text,
              sigilStyle,
              roman,
              legend,
            }),
          )}`,
      ),
    );
    expect(
      sha256(drawings.join("\n\n")),
      `the styles' drawings differ from those ${ANGEL_SIGIL_IMAGE_PROFILE} was reviewed with. ` +
        "If the drawing changed on purpose, bump ANGEL_SIGIL_IMAGE_PROFILE in angelSigilImage.tsx " +
        "and record the new digest under the new profile; never re-pin a shipped profile.",
    ).toBe(ANGEL_SIGIL_DRAWING_DIGESTS[ANGEL_SIGIL_IMAGE_PROFILE]);
  }, 60_000);
});
