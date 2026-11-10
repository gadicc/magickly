import data from "magick-data";

/**
 * The sixteen figures by meaning pairs, the reference's first order: gain
 * and loss, white and red, girl and boy, joy and sorrow, the Dragon's Head
 * and Tail, people and way, conjunction and prison, the greater and lesser
 * fortune. Shared by the grid and the page's text, which is a server
 * component and so can't take it from the grid's client module.
 */
export function figuresByPairs() {
  const t = data.tetragram;
  return [
    t.acquisitio,
    t.amissio,
    t.albus,
    t.rubeus,
    t.puella,
    t.puer,
    t.laetitia,
    t.tristitia,
    t.caput_draconis,
    t.cauda_draconis,
    t.populus,
    t.via,
    t.conjunctio,
    t.carcer,
    t.fortuna_major,
    t.fortuna_minor,
  ];
}
