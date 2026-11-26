import { SITE_DESCRIPTION, SITE_TITLE } from "./site";

/** A shared-link preview image; relative URLs resolve against the site. */
export interface SocialImage {
  url: string;
  width: number;
  height: number;
  alt: string;
}

/** Search and sharing copy for one indexable URL. */
export interface SeoPage {
  /** Title without the site suffix, which the root layout template adds. */
  title: string;
  /** Search result snippet, about 70 to 160 characters. */
  description: string;
  /** Use the title as-is instead of applying the site suffix. */
  absoluteTitle?: boolean;
  image?: SocialImage;
}

/**
 * Every indexable static route. The sitemap is built from these keys, and a
 * test requires each `page.tsx` to be listed here, be an entity route, or be
 * private.
 */
export const PUBLIC_PAGES = {
  "/": {
    title: SITE_TITLE,
    absoluteTitle: true,
    description: SITE_DESCRIPTION,
  },
  "/about": {
    title: "About",
    description:
      "About Magick.ly, an open source reference app for magickal study with " +
      "MIT-licensed data and components. A reference, not an instruction app.",
  },
  "/astrology": {
    title: "Astrology for Magicians",
    description:
      "Astrology tools for magical work: planetary hours for your location, " +
      "the planets with their Hebrew names, the zodiac signs and moon phases.",
  },
  "/astrology/kamea": {
    title: "Kamea: The Seven Planetary Magic Squares",
    description:
      "A kamea is a planet's magic square. The seven, from Saturn's 3×3 to " +
      "the Moon's 9×9, as Agrippa printed each kamea bar two misprints, with its names and sigils.",
  },
  "/astrology/kamea/saturn": {
    title: "Kamea of Saturn: The Magic Square of Saturn",
    description:
      "The kamea of Saturn, its 3×3 magic square of 1 to 9 with lines of 15, " +
      "as Agrippa printed it, with the names Agiel and Zazel, their numbers and its seal.",
  },
  "/astrology/kamea/jupiter": {
    title: "Kamea of Jupiter: The Magic Square of Jupiter",
    description:
      "The kamea of Jupiter, its 4×4 magic square of 1 to 16 with lines of 34, " +
      "as Agrippa printed it, with Iophiel and Hismael, their numbers and its seal.",
  },
  "/astrology/kamea/mars": {
    title: "Kamea of Mars: The Magic Square of Mars",
    description:
      "The kamea of Mars, its 5×5 magic square of 1 to 25 with lines of 65, " +
      "as Agrippa printed it, with Graphiel and Bartzabel, their numbers and its seal.",
  },
  "/astrology/kamea/sol": {
    title: "Kamea of the Sun: The Magic Square of Sol",
    description:
      "The kamea of the Sun, the 6×6 magic square of Sol: 1 to 36, lines of 111 " +
      "and a sum of 666, as Agrippa printed it, with Nakhiel, Sorath and its seal.",
  },
  "/astrology/kamea/venus": {
    title: "Kamea of Venus: The Magic Square of Venus",
    description:
      "The kamea of Venus, its 7×7 magic square of 1 to 49 with lines of 175, " +
      "as Agrippa printed it bar one misprint, with Hagiel, Kedemel and the Bne Seraphim.",
  },
  "/astrology/kamea/mercury": {
    title: "Kamea of Mercury: The Magic Square of Mercury",
    description:
      "The kamea of Mercury, its 8×8 magic square of 1 to 64 with lines of 260, " +
      "as Agrippa printed it, with Tiriel, Taphthartharath and its seal.",
  },
  "/astrology/kamea/luna": {
    title: "Kamea of the Moon: The Magic Square of Luna",
    description:
      "The kamea of the Moon, the 9×9 magic square of Luna: 1 to 81 with lines " +
      "of 369, as Agrippa printed it bar one misprint, with Chasmodai and Malcha.",
  },
  "/astrology/kamea/sigils": {
    title: "Kamea Sigil Generator: Magic Square Sigils",
    description:
      "Trace the sigil of a Hebrew name on the kamea of its planet by the " +
      "Aiq Bekar reduction Regardie sets out, from Saturn's square to the Moon's.",
  },
  "/astrology/moon": {
    title: "Moon Phases",
    description:
      "The current moon phase with the dates of the last and next new moon, " +
      "first quarter, full moon and third quarter in your local time.",
  },
  "/astrology/planetary-hours": {
    title: "Planetary Hours Calculator",
    description:
      "Planetary hours for the coming week at your location, with the " +
      "current hour marked and each planet's operations from the Key of Solomon.",
  },
  "/astrology/planets": {
    title: "The Planets: Symbols and Hebrew Names",
    description:
      "The classical planets and Kabbalistic heavens with their symbols and " +
      "English and Hebrew names, plus live Moon phase and Mercury retrograde widgets.",
  },
  "/astrology/zodiac": {
    title: "Zodiac Signs, Meanings and Rulers",
    description:
      "The twelve signs of the zodiac with their symbols, meanings, date " +
      "ranges and ruling planets, from Aries the Ram to Pisces the Fish.",
  },
  "/chat": {
    title: "MagickGPT: Ask an AI About Magick",
    description:
      "Ask MagickGPT, an AI assistant that answers from a library of magickal " +
      "texts and cites its sources. It can make mistakes, so check them.",
  },
  "/enochian": {
    title: "Enochian Magick",
    description:
      "Enochian magick of John Dee and Edward Kelley: the Keys, a dictionary " +
      "and translator, the elemental tablets, Dee's Oration to God and flashcards.",
  },
  "/enochian/dictionary": {
    title: "Enochian Dictionary",
    description:
      "Look up Enochian words by English meaning or spelling: 1,917 words " +
      "with pronunciations, sources, the script, where Dee's Keys use them " +
      "and Schueler's gematria.",
  },
  "/enochian/keys": {
    title: "The Enochian Keys (Calls)",
    description:
      "The nineteen Enochian Keys, or Calls, with the Call of the Thirty " +
      "Aethyrs, in Dee's and the Golden Dawn's versions, each word looked up " +
      "in the dictionary.",
  },
  "/enochian/oration": {
    title: "John Dee's Oration to God",
    description:
      "John Dee's Oration to God, to be said every day, three times over, from " +
      "his own manuscript, with Geoffrey James's version and where they differ.",
  },
  "/enochian/translate": {
    title: "Enochian Translator",
    description:
      "Translate English into Enochian and Enochian into English by looking " +
      "up Dee's Keys and our dictionary, with an AI reading of Enochian " +
      "checked against them.",
  },
  "/enochian/tablets": {
    title: "Enochian Elemental Tablets",
    description:
      "The Enochian Watchtowers in the Golden Dawn's version or Dee's, and " +
      "the Golden Dawn's Tablet of Union: holy names, Kings, Seniors, " +
      "archangels, and differences.",
  },
  "/enochian/tablets/earth": {
    title: "Enochian Earth Tablet: Watchtower of the North",
    description:
      "MOR DIAL HCTGA, the three holy names of the Enochian Earth tablet, with " +
      "its King Iczhihal, its Seniors, every name read off it, and its images.",
  },
  "/enochian/tablets/air": {
    title: "Enochian Air Tablet: Watchtower of the East",
    description:
      "ORO IBAH AOZPI, the three holy names of the Enochian Air tablet, with " +
      "its King Bataivah, its Seniors, every name read off it, and its images.",
  },
  "/enochian/tablets/water": {
    title: "Enochian Water Tablet: Watchtower of the West",
    description:
      "MPH ARSL GAIOL, the three holy names of the Enochian Water tablet, with " +
      "its King Raagiosl, its Seniors, every name read off it, and its images.",
  },
  "/enochian/tablets/fire": {
    title: "Enochian Fire Tablet: Watchtower of the South",
    description:
      "OIP TEAA PDOCE, the three holy names of the Enochian Fire tablet, with " +
      "its King Edlprnaa, its Seniors, every name read off it, and its images.",
  },
  "/enochian/tablets/union": {
    title: "Enochian Tablet of Union",
    description:
      "EXARP, HCOMA, NANTA and BITOM, the four lines of the Enochian " +
      "Tablet of Union, which joins the four Watchtowers, with its names and its images.",
  },
  "/gd": {
    title: "Golden Dawn",
    description:
      "Hermetic Order of the Golden Dawn resources: the grades on the Tree of " +
      "Life, grade rituals, temple halls, Rose Cross sigils and temple symbols.",
  },
  "/gd/grades": {
    title: "Golden Dawn Grades",
    description:
      "The grades of the Golden Dawn from Neophyte 0=0 to Ipsissimus 10=1, " +
      "the Portal among them, with their places on the Tree of Life and " +
      "their correspondences.",
  },
  "/gd/halls": {
    title: "Golden Dawn Temple Halls: Floor Plans",
    description:
      "Floor plans of the fourteen Golden Dawn temple halls, Neophyte to " +
      "Portal: officers' stations, sources, and PNG and SVG downloads under " +
      "CC BY 4.0.",
  },
  "/gd/halls/editor": {
    title: "Golden Dawn Temple Hall and Floor Plan Editor",
    description:
      "Design a Golden Dawn temple hall in your browser: place officers, " +
      "furniture, banners and tablets in Pug source or visually, then " +
      "export SVG or PNG.",
  },
  "/gd/rituals": {
    title: "Golden Dawn Rituals",
    description:
      "Golden Dawn grade rituals from Regardie, laid out for phones and " +
      "tablets, plus the private temple rituals you can read when signed in.",
  },
  "/gd/sigils": {
    title: "Golden Dawn Sigil Generator: Rose Cross Sigils",
    description:
      "Draw the Rose Cross sigil of any Hebrew name or angel by the Golden " +
      "Dawn's own rules, as Regardie printed them. Animated, and exportable " +
      "as SVG or PNG.",
  },
  "/gd/symbols": {
    title: "Golden Dawn Temple Symbols",
    description:
      "Golden Dawn temple symbols drawn as vector images: the Fylfot Cross, " +
      "the Seven-Branched Candlestick and the Table of Shewbread.",
  },
  "/gd/symbols/candlestick": {
    title: "Seven-Branched Candlestick",
    description:
      "The Golden Dawn Seven-Branched Candlestick with its planets, their " +
      "angels and Hebrew names, as a downloadable vector image.",
  },
  "/gd/symbols/fylfot-cross": {
    title: "Fylfot Cross of the Elements and Zodiac",
    description:
      "The Golden Dawn Fylfot Cross of the four elements and twelve signs " +
      "around the Sun, with an exercise to place each symbol yourself.",
  },
  "/gd/symbols/shewbread": {
    title: "Table of Shewbread",
    description:
      "The Golden Dawn Table of Shewbread with the twelve signs, the " +
      "permutations of the Tetragrammaton and the tribes of Israel.",
  },
  "/doc/neophyte": {
    title: "Neophyte 0=0 Ritual",
    description:
      "The Golden Dawn Neophyte 0=0 grade ritual as published by Israel " +
      "Regardie, laid out for reading on phones with officer roles.",
  },
  "/doc/zelator": {
    title: "Zelator 1=10 Ritual",
    description:
      "The Golden Dawn Zelator 1=10 grade ritual as published by Israel " +
      "Regardie, laid out for reading on phones with officer roles.",
  },
  "/doc/theoricus": {
    title: "Theoricus 2=9 Ritual",
    description:
      "The Golden Dawn Theoricus 2=9 grade ritual as published by Israel " +
      "Regardie, laid out for reading on phones with officer roles.",
  },
  "/geomancy": {
    title: "Geomancy",
    description:
      "Golden Dawn geomancy: cast a reading with its astrological chart, and " +
      "look up the sixteen geomantic figures and their correspondences.",
  },
  "/geomancy/reading": {
    title: "Geomancy Reading",
    description:
      "Cast a geomantic reading: generate the four mothers, see the figures " +
      "on an astrological chart and read the interpretation for your question.",
  },
  "/geomancy/reference": {
    title: "The Sixteen Geomantic Figures",
    description:
      "The sixteen geomantic figures with their meanings and correspondences, " +
      "sortable by pairs, name or binary value.",
  },
  "/help/temples": {
    title: "Temples and private rituals",
    description:
      "Run a temple on Magick.ly: manage members and grades, invite people, and " +
      "keep private rituals readable by grade, on any device.",
  },
  "/help/ritual-pug": {
    title: "Ritual Pug guide",
    description:
      "How to write a ritual in Ritual Pug, the source view of the ritual " +
      "editor: source, split and visual layouts, and block identities that " +
      "survive edits.",
  },
  "/kabbalah": {
    title: "Kabbalah",
    description:
      "Hermetic Kabbalah resources: an interactive Tree of Life with its " +
      "Sephiroth and paths, and the 72 angels of the Shem HaMephorash.",
  },
  "/kabbalah/tree": {
    title: "Kabbalistic Tree of Life",
    description:
      "An interactive Tree of Life: choose the names, colour scale and letter " +
      "attributions shown on each Sephirah and path, then export the diagram.",
  },
  "/kabbalah/yhvh": {
    title: "Shem HaMephorash",
    description:
      "The Shem HaMephorash, the 72-fold name of God drawn from the three " +
      "72-letter verses of Exodus 14:19–21, and the 72 angels named after it.",
  },
  "/open-source": {
    title: "Open Source Licences and Packages",
    description:
      "What you may reuse from Magick.ly and how: the app under AGPL, the " +
      "code under MIT, the data and images under CC BY 4.0, and the packages.",
  },
  "/open-source/data": {
    title: "Open Data: the magick-data Tables",
    description:
      "Every table in magick-data, the site's open data on npm: the sephirot, " +
      "planets, letters, grades and more, with their rows, fields and links.",
  },
  "/open-source/components": {
    title: "Open Source React Components: magick-components",
    description:
      "magick-components, the MIT React components that draw the Tree of " +
      "Life, the temple halls, the Enochian tablets and more, each live with its props.",
  },
  "/books": {
    title: "Books",
    description:
      "Public-domain works of the Western esoteric tradition, read from their " +
      "original scans and published in full with an editorial apparatus.",
  },
  "/books/la-science-cabalistique": {
    title: "La Science Cabalistique (1823)",
    description:
      "Lazare Lenain's La Science Cabalistique, Amiens 1823, complete: the 72 " +
      "angels of the Kabbalah, their attributes, seals and hours, read from " +
      "the original scan.",
  },
  "/kabbalah/yhvh/72angels": {
    title: "The 72 Angels of the Shem HaMephorash",
    description:
      "The 72 angels of the Shem HaMephorash with their Hebrew names, dates " +
      "and attributes, from Lazare Lenain's La Science Cabalistique (1823).",
  },
  "/study": {
    title: "Magick Flashcards",
    description:
      "Spaced-repetition flashcards for Golden Dawn study: Hebrew letters, " +
      "planetary and zodiac signs, alchemy, Enochian and more.",
  },
} as const satisfies Record<string, SeoPage>;

export type PublicPath = keyof typeof PUBLIC_PAGES;
