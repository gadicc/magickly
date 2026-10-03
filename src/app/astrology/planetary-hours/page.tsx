import planets from "magick-data/astrology/planets";
import { pageMetadata } from "@/seo/metadata";
import PlanetaryHours, { type HourPlanet } from "./planetaryHours";

export const metadata = pageMetadata("/astrology/planetary-hours");

/**
 * What the Key of Solomon says each planet's days and hours serve for, read
 * from the planet data here, on the server, and passed to the client
 * component as a prop. The typed table module is the planet JSON alone,
 * where the barrel would load and link every table; neither reaches the
 * client, which receives only these seven strings.
 */
const keyOfSolomon: Record<HourPlanet, string> = {
  sol: planets.sol.keyOfSolomon.en,
  venus: planets.venus.keyOfSolomon.en,
  mercury: planets.mercury.keyOfSolomon.en,
  luna: planets.luna.keyOfSolomon.en,
  saturn: planets.saturn.keyOfSolomon.en,
  jupiter: planets.jupiter.keyOfSolomon.en,
  mars: planets.mars.keyOfSolomon.en,
};

export default function PlanetaryHoursPage() {
  return <PlanetaryHours keyOfSolomon={keyOfSolomon} />;
}
