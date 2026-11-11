"use client";

import MercuryWidget from "@magick-components/astrology/Mercury";
import MoonWidget from "@magick-components/astrology/Moon";
import { planetName } from "@magick-components/astrology/planetName";
import Link from "@magick-components/Link";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Data from "magick-data";
import Tiles from "@/components/Tiles";
import usePlace from "@/geo/usePlace";
import OpenSource from "@/OpenSource";

/**
 * The moon as seen from the reader's place (plan 072), which the MIT moon
 * widget can't look up itself: its components import no app code.
 */
export function PlaceMoon() {
  const { place } = usePlace();
  return <MoonWidget latitude={place?.latitude} />;
}

// Both previews show live data (the phase, the retrograde dates), so they
// are informative and screen readers read them.
const tiles = [
  {
    Component: PlaceMoon,
    title: "Moon ☾",
    informative: true,
    to: "moon",
  },
  {
    Component: MercuryWidget,
    title: "Mercury ☿",
    informative: true,
    to: "planet/mercury",
  },
];

const NARROW_HIDDEN = { display: { xs: "none", sm: "table-cell" } };

export default function Planets() {
  return (
    <Container maxWidth="sm">
      <Box sx={{ my: 4 }}>
        <Tiles tiles={tiles} />

        <TableContainer component={Paper}>
          <Table aria-label="Planets">
            <TableHead>
              <TableRow>
                {/* Phones fold the symbol into the name to make room. */}
                <TableCell sx={NARROW_HIDDEN}>Symbol</TableCell>
                <TableCell>English</TableCell>
                <TableCell>Hebrew</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {Object.values(Data.planet).map((planet) => (
                <TableRow key={planet.id}>
                  <TableCell sx={NARROW_HIDDEN}>{planet.symbol}</TableCell>

                  {/* One link per row, so each planet is one tab stop. */}
                  <TableCell component="th" scope="row">
                    {planet.symbol && (
                      <Box
                        component="span"
                        aria-hidden
                        sx={{ display: { sm: "none" }, mr: 1 }}
                      >
                        {planet.symbol}
                      </Box>
                    )}
                    <Link href={"/astrology/planet/" + planet.id}>
                      {planetName(planet)}
                    </Link>
                  </TableCell>

                  <TableCell>
                    {planet.name.he && (
                      // The transliteration wraps below only when it must.
                      <Box
                        sx={{
                          display: "flex",
                          flexWrap: "wrap",
                          alignItems: "baseline",
                          columnGap: 1,
                        }}
                      >
                        <Box
                          component="span"
                          lang="he"
                          dir="rtl"
                          sx={{ fontSize: "1.25em" }}
                        >
                          {planet.name.he.he}
                        </Box>
                        <Box
                          component="span"
                          lang="he-Latn"
                          sx={{ color: "text.secondary" }}
                        >
                          {planet.name.he.roman}
                        </Box>
                      </Box>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <br />
        <OpenSource
          files={[
            "@/app/astrology/planets/planets.tsx",
            "@magick-components/astrology/Moon.tsx",
            "@magick-components/astrology/Mercury.tsx",
            "@magick-components/astrology/mercuryRetrograde.ts",
          ]}
        />

        <p style={{ fontSize: "80%" }}>
          <Link href="/about#credits">Image credits</Link>
        </p>
      </Box>
    </Container>
  );
}
