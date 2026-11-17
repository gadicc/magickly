import { Box } from "@mui/material";
import { pageMetadata } from "@/seo/metadata";
import Link from "@/ui/Link";
import Tiles from "@/ui/Tiles";
import AstrologyText from "../../astrology/AstrologyText";
import PlanetaryHoursPic from "../../astrology/img/planetary-hours.webp";
import AstrologyTile from "../../img/astrology.jpeg";

export const metadata = pageMetadata("/astrology");

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
