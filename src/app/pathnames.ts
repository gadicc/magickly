/**
 * A page title. Titles depend only on the path, so the app bar renders on
 * the server without the query.
 */
export type PathnameValue = string;

/** A section: its own title under "/", and its child paths. */
export interface Pathnames {
  "/": PathnameValue;
  [key: string]: PathnameValue | Pathnames;
}

/**
 * Every path here has a page: the drawer links each one, and the bar takes a
 * path's title for the page's heading. A route below a section with no entry
 * of its own, such as `/kabbalah/sephirah/<id>` or `/kabbalah/angel/<slug>`,
 * gets the section's breadcrumb and the page names itself.
 */
const pathnames: Pathnames = {
  "/": /*i18n*/ "Magick.ly",
  about: /*i18n*/ "About",
  admin: /*i18n*/ "Admin",
  astrology: {
    "/": /*i18n*/ "Astrology",
    moon: /*i18n*/ "Moon Phases",
    "planetary-hours": /*i18n*/ "Planetary Hours",
    planets: /*i18n*/ "Planets",
    zodiac: /*i18n*/ "Zodiac",
  },
  books: {
    "/": /*i18n*/ "Books",
    "la-science-cabalistique": /*i18n*/ "La Science Cabalistique",
  },
  chat: /*i18n*/ "Chat (MagickGPT)",
  enochian: {
    "/": /*i18n*/ "Enochian",
    dictionary: /*i18n*/ "Enochian Dictionary",
    keys: /*i18n*/ "Enochian Keys",
    oration: /*i18n*/ "Oration to God",
    tablets: /*i18n*/ "Enochian Tablets",
    translate: /*i18n*/ "Enochian Translator",
  },
  gd: {
    "/": /*i18n*/ "Golden Dawn",
    grades: /*i18n*/ "Grades",
    // A section, so each hall's page under it shows the trail.
    halls: { "/": /*i18n*/ "Temple Halls", editor: /*i18n*/ "Hall Editor" },
    rituals: { "/": /*i18n*/ "Rituals", deleted: /*i18n*/ "Recently deleted" },
    sigils: /*i18n*/ "Sigils",
    symbols: {
      "/": /*i18n*/ "Symbols",
      candlestick: /*i18n*/ "Seven-Branched Candlestick",
      "fylfot-cross": /*i18n*/ "Fylfot Cross",
      shewbread: /*i18n*/ "Table of Shewbread",
    },
  },
  geomancy: {
    "/": /*i18n*/ "Geomancy",
    reading: /*i18n*/ "Geomancy Reading",
    reference: /*i18n*/ "Geomantic Figures",
  },
  kabbalah: {
    "/": /*i18n*/ "Kabbalah",
    yhvh: {
      "/": /*i18n*/ "Shem HaMephorash",
      "72angels": /*i18n*/ "72 Angels",
    },
    tree: /*i18n*/ "Tree of Life",
  },
  // Data and Components are sections, so that a table's page and a
  // component's page below them name themselves, as an entity page does,
  // under "Open source › Data" and "Open source › Components".
  "open-source": {
    "/": /*i18n*/ "Open source",
    data: { "/": /*i18n*/ "Data" },
    components: { "/": /*i18n*/ "Components" },
  },
  study: /*i18n*/ "Study", // TODO, from pages router
  temples: {
    "/": /*i18n*/ "Temples",
    admin: /*i18n*/ "Admin",
  },
};

export default pathnames;
