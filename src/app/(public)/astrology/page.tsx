import { Box } from "@mui/material";
import { planetaryName } from "@/app/astrology/kamea/planetaryNames";
import { kameaFiles } from "@/seo/kameas";
import { pageMetadata } from "@/seo/metadata";
import { planetaryNameSigilFiles } from "@/seo/planetaryNames";
import Link from "@/ui/Link";
import Tiles from "@/ui/Tiles";
import AstrologyText from "../../astrology/AstrologyText";
import PlanetaryHoursPic from "../../astrology/img/planetary-hours.webp";
import AstrologyTile from "../../img/astrology.jpeg";

export const metadata = pageMetadata("/astrology");

// The kamea pages' own static files (plan 093, K4): Saturn's square, and
// Agiel's sigil traced on it. Both are dark ink on a transparent ground.
const agiel = planetaryName("agiel");
if (!agiel) throw new Error("planetaryNames has no agiel");

const tiles = [
  {
    title: "Planetary Hours",
    to: "/astrology/planetary-hours",
    img: PlanetaryHoursPic,
    alt: "Planets around a clock",
  },
  {
    title: "Planets",
    to: "/astrology/planets",
    img: "/pics/planets2013.jpg",
    alt: "Our solar system",
  },
  {
    title: "Zodiac",
    to: "/astrology/zodiac",
    img: AstrologyTile,
    alt: "zodiac wheel",
  },
  {
    title: "Kameas",
    to: "/astrology/kamea",
    img: kameaFiles("saturn").png.path,
    alt: "The kamea of Saturn, a three by three magic square",
    plate: true,
  },
  {
    title: "Kamea Sigils",
    to: "/astrology/kamea/sigils",
    img: planetaryNameSigilFiles(agiel).png.path,
    alt: "The sigil of Agiel traced on the kamea of Saturn",
    plate: true,
  },
];

function Astrology() {
  return (
    <>
      <Tiles tiles={tiles} />
      <AstrologyText />
      <Box sx={{ m: 2, fontSize: "80%" }}>
        <Link href="/about#credits">Image credits</Link>
      </Box>
    </>
  );
}

export default Astrology;
