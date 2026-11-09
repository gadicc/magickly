/** Development probes, not an independently labelled retrieval benchmark. */
export const SEARCH_PROBES = [
  { query: "Planetary hours", expected: ["/astrology/planetary-hours"] },
  { query: "Tree of Life", expected: ["/kabbalah/tree"] },
  { query: "Qabalah", expected: ["/kabbalah", "/kabbalah/tree"] },
  { query: "Vehuiah", expected: ["/kabbalah/angel/vehuiah"] },
  { query: "draw a sigil from a Hebrew name", expected: ["/gd/sigils"] },
  {
    query: "when is a good time to perform planetary magic",
    expected: ["/astrology/planetary-hours"],
  },
  {
    query: "find the officers' positions in a Golden Dawn temple",
    expected: ["/gd/halls"],
  },
  { query: "practice remembering the Hebrew alphabet", expected: ["/study"] },
  {
    query: "the nineteen invocations of John Dee",
    expected: ["/enochian/keys"],
  },
  {
    query: "calculate a divination chart with four mothers",
    expected: ["/geomancy/reading"],
  },
  { query: "שעות פלנטריות", expected: ["/astrology/planetary-hours"] },
  { query: "עץ החיים בקבלה", expected: ["/kabbalah/tree", "/kabbalah"] },
  { query: "לצייר סיגיל משם בעברית", expected: ["/gd/sigils"] },
  { query: "ללמוד את האותיות העבריות", expected: ["/study"] },
  { query: "heures planétaires", expected: ["/astrology/planetary-hours"] },
  { query: "dessiner un sceau avec un nom hébreu", expected: ["/gd/sigils"] },
  {
    query: "les soixante-douze anges",
    expected: [
      "/kabbalah/yhvh/72angels",
      "/books/la-science-cabalistique/chapitre-6",
    ],
  },
  { query: "惑星時間を計算したい", expected: ["/astrology/planetary-hours"] },
  { query: "生命の樹を表示", expected: ["/kabbalah/tree"] },
  {
    query: "what does each geomantic figure mean",
    expected: ["/geomancy/reference"],
  },
];
