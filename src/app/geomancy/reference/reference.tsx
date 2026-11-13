"use client";
import {
  Container,
  FormControlLabel,
  FormGroup,
  Grid,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import Typography from "@mui/material/Typography";
import PlanetarySpirit from "magick-components/astrology/planetarySpirits";
import data from "magick-data";
import { PlanetId } from "magick-data/astrology/planets";
import React from "react";
import Ink from "@/drawings/Ink";
import { capitalizeFirstLetter } from "@/lib/utils";
import Tetragram from "../Tetragram";
import { figuresByPairs } from "./pairs";

const _tetragrams = data.tetragram;
const houses = data.geomanticHouse;

/*
function id2title(str: string) {
  return (str[0].toUpperCase() + str.substring(1)).replace(
    /_(\w)/,
    (m, p1) => " " + p1.toUpperCase()
  );
}
*/

// https://stackoverflow.com/questions/13627308/add-st-nd-rd-and-th-ordinal-suffix-to-a-number
const nth = (n) =>
  ["st", "nd", "rd"][((((n + 90) % 100) - 10) % 10) - 1] || "th";

const rowsToBinary = (rows: readonly number[]) =>
  parseInt(rows.map((r) => (r === 1 ? "0" : "1")).join(""), 2);
export default function Geomancy() {
  const [showAssoc, setShowAssoc] = React.useState(false);
  const [sortBy, setSortBy] = React.useState<"alpha" | "pairs" | "binary">(
    "pairs",
  );

  const tetragrams = React.useMemo(() => {
    if (sortBy === "pairs") return figuresByPairs();

    const tetragrams = Object.values(_tetragrams);
    if (sortBy === "alpha")
      tetragrams.sort((a, b) => a.title.en.localeCompare(b.title.en));
    else if (sortBy === "binary")
      tetragrams.sort((a, b) => rowsToBinary(a.rows) - rowsToBinary(b.rows));
    return tetragrams;
  }, [sortBy]);
  const byPairs = sortBy === "pairs" || sortBy === "binary";

  return (
    <>
      <Container sx={{ my: 1 }}>
        <p>
          The figures&apos; meanings, and their meanings in each house, are the
          Golden Dawn&apos;s table as Crowley printed it in{" "}
          <a href="https://archive.org/details/crowley-equinox_202110/The%20Equinox%20Vol.%201%2C%20No.%202/page/n158/mode/1up">
            “A Handbook of Geomancy”
          </a>
          , <i>The Equinox</i> I(2), 1909, with its abbreviations spelled out
          and “evil” read as “unfavourable”. What each house governs follows{" "}
          <a href="https://archive.org/details/b20458563/page/n34/mode/1up">
            Agrippa&apos;s Fourth Book
          </a>{" "}
          (Turner, 1655), in our own words.
        </p>

        <div style={{ textAlign: "center" }}>
          <Typography variant="h4" component="h2" sx={{ my: 2 }}>
            16 Tetragrams
          </Typography>
          <Select
            value={sortBy}
            onChange={(e) =>
              setSortBy(e.target.value as "alpha" | "pairs" | "binary")
            }
            size="small"
          >
            <MenuItem value="alpha">sort alphabetically</MenuItem>
            <MenuItem value="pairs">sort by meaning pairs</MenuItem>
            <MenuItem value="binary">sort by binary value</MenuItem>
          </Select>
          <br />
          <FormGroup sx={{ alignItems: "center" }}>
            <FormControlLabel
              control={
                <Switch
                  checked={showAssoc}
                  onChange={() => setShowAssoc(!showAssoc)}
                />
              }
              label="show associations"
            />
          </FormGroup>
        </div>
        <br />

        <Grid container spacing={2} sx={{ p: 0 }}>
          {tetragrams.map((tetragram) => (
            <Grid
              key={tetragram.id}
              size={{
                xs: 6,
                sm: byPairs ? 6 : 4,
                md: byPairs ? 6 : 3,
                lg: byPairs ? 6 : 2,
                xl: byPairs ? 6 : 1,
              }}
            >
              <Grid container spacing={2}>
                <Grid size={8}>
                  <b>{tetragram.title.en}</b>
                  <br />({tetragram.translation.en})
                </Grid>
                <Grid size={4}>
                  <Stack direction="row" spacing={1}>
                    <Ink drawing="tetragram">
                      <Tetragram rows={tetragram.rows} />
                    </Ink>
                    {showAssoc && (
                      <div
                        style={{
                          paddingTop: 3,
                          fontSize: "90%",
                          textAlign: "center",
                          lineHeight: "1em",
                        }}
                      >
                        {tetragram.zodiacId &&
                          data.zodiac[tetragram.zodiacId].symbol}
                        <br />
                        {data.element[tetragram.elementId]?.symbol}
                        <br />
                        {/* tetragram.rulerIds */}
                        {tetragram.planetIds
                          .map((p) => data.planet[p].symbol)
                          .join("/")}
                      </div>
                    )}
                  </Stack>
                </Grid>
              </Grid>
            </Grid>
          ))}
        </Grid>
        <br />

        <Typography
          variant="h4"
          component="h2"
          sx={{ my: 2 }}
          style={{ textAlign: "center" }}
        >
          Spirits and Rulers
        </Typography>

        <TableContainer component={Paper}>
          <Table aria-label="planets, spirits, rulers, sigils">
            <TableHead>
              <TableRow>
                <TableCell align="center">Planet</TableCell>
                <TableCell align="center">Intelligence</TableCell>
                <TableCell align="center">Spirit / Ruler</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {["sol", "mercury", "venus", "luna", "mars", "jupiter", "saturn"]
                .map((planetId: PlanetId) => data.planet[planetId])
                .map((planet) => (
                  <TableRow
                    key={planet.id}
                    sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
                  >
                    <TableCell align="center">
                      {planet.symbol} {planet.name.en.en}
                    </TableCell>
                    <TableCell align="center">
                      {capitalizeFirstLetter(planet.intelligenceId || "")}
                    </TableCell>
                    <TableCell align="center">
                      {capitalizeFirstLetter(planet.spiritId || "")} &nbsp;
                      <Ink drawing="spirit">
                        <PlanetarySpirit
                          id={planet.spiritId}
                          height="1.1em"
                          display="inline-block"
                        />
                      </Ink>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </TableContainer>
        <br />

        <Typography
          variant="h4"
          component="h2"
          sx={{ my: 2 }}
          style={{ textAlign: "center" }}
        >
          Geomantic Houses
        </Typography>

        <div style={{ textAlign: "justify" }}>
          {Object.values(houses).map((house) => (
            <p key={house.id}>
              <b>
                {house.id}
                {nth(house.id)} House:
              </b>{" "}
              {house.meaning.en}
            </p>
          ))}
        </div>

        <Typography
          variant="h4"
          component="h2"
          sx={{ my: 2 }}
          style={{ textAlign: "center" }}
        >
          Meanings in the Houses
        </Typography>

        {Object.values(tetragrams).map((tetragram) => (
          <div key={tetragram.id}>
            <b>{tetragram.title.en}</b>
            <br />
            <i> {tetragram.meaning.en}</i>
            <br />
            <ol>
              {Object.entries(tetragram.meanings).map(([houseNo, meaning]) => (
                <li key={houseNo}>{meaning.en}</li>
              ))}
            </ol>
          </div>
        ))}
      </Container>
    </>
  );
}
