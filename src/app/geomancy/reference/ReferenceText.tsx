import Link from "@magick-components/Link";
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import data from "magick-data";
import { H2, List, PageText } from "@/app/PageText";
import { figuresByPairs } from "./pairs";

/**
 * The sixteen figures and how to use the reference, below it (plan 071, decision 5).
 */
export default function ReferenceText() {
  return (
    <PageText labelledBy="reference-text">
      <H2 id="reference-text">The sixteen figures</H2>
      <p>
        A geomantic figure is four rows, each of one point or two, so there are
        exactly sixteen of them (two to the fourth power). Reading down the
        rows, the head, neck, body and feet, gives each figure its shape. Read
        as binary, that shape is also how the page can sort them.
      </p>
      <FiguresTable />
      <H2>Using this page</H2>
      <p>
        The grid opens sorted by meaning pairs: gain and loss, white and red,
        joy and sorrow. You can also sort it alphabetically or by binary value.
        Turn on <i>show associations</i> to see each figure&apos;s sign, element
        and planet. Below the grid are the seven planets with their
        intelligences and spirits and the spirits&apos; sigils, then the twelve
        geomantic houses and what each governs. Last come the sixteen figures
        again, each with its general meaning and its meaning in every house. The
        meanings follow the Golden Dawn&apos;s practice as the Ciceros present
        it.
      </p>
      <H2>Related</H2>
      <List>
        <li>
          <Link href="/geomancy/reading">Geomancy Reading</Link>: cast the
          Mothers and read them on the chart
        </li>
        <li>
          <Link href="/astrology/planets">The planets</Link>, and the seven
          whose spirits rule the figures:{" "}
          <Link href="/astrology/planet/saturn">Saturn</Link>,{" "}
          <Link href="/astrology/planet/jupiter">Jupiter</Link>,{" "}
          <Link href="/astrology/planet/mars">Mars</Link>,{" "}
          <Link href="/astrology/planet/sol">Sol</Link>,{" "}
          <Link href="/astrology/planet/venus">Venus</Link>,{" "}
          <Link href="/astrology/planet/mercury">Mercury</Link> and{" "}
          <Link href="/astrology/planet/luna">Luna</Link>
        </li>
        <li>
          <Link href="/astrology/zodiac">The zodiac</Link>
        </li>
      </List>
    </PageText>
  );
}

/**
 * Each figure's meaning, sign and planets, by meaning pairs, from the data;
 * the meaning sits under the name so that the table fits a phone.
 */
function FiguresTable() {
  return (
    <TableContainer sx={{ my: 2 }}>
      <Table size="small" aria-label="The sixteen geomantic figures">
        <TableHead>
          <TableRow>
            <TableCell>Figure</TableCell>
            <TableCell>Sign</TableCell>
            <TableCell>Planet</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {figuresByPairs().map((figure) => (
            <TableRow key={figure.id}>
              <TableCell component="th" scope="row">
                {figure.title.en}
                <Box
                  component="span"
                  sx={{ display: "block", color: "text.secondary" }}
                >
                  {figure.translation.en}
                </Box>
              </TableCell>
              <TableCell>
                {figure.zodiacId ? data.zodiac[figure.zodiacId].name.en : "–"}
              </TableCell>
              <TableCell>
                {figure.planetIds
                  .map((id) => data.planet[id].name.en.en)
                  .join(" and ")}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
