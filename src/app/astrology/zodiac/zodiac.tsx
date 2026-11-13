"use client";
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

const DAY = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

/**
 * A sign's first or last day, `[month, day]`, as "21 March", kept on one
 * line so that a narrow column wraps only between the two days.
 */
function day([month, date]: readonly number[]) {
  return DAY.format(Date.UTC(2000, month - 1, date)).replace(" ", "\u00a0");
}

export default function signs() {
  return (
    <Container maxWidth="sm">
      <Box sx={{ my: 4 }}>
        <TableContainer component={Paper}>
          <Table aria-label="simple table">
            <TableHead>
              <TableRow>
                <TableCell>Sign & Symbol</TableCell>
                <TableCell>Meaning</TableCell>
                <TableCell>Rules from</TableCell>
                <TableCell>Ruled by</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {Object.values(Data.zodiac).map((sign) => (
                // No sign has a page yet: each row is anchored, for the
                // angel pages to link to, and marked when it is the target.
                <TableRow
                  key={sign.id}
                  id={sign.id}
                  sx={{
                    scrollMarginTop: { xs: "4.5rem", sm: "5rem" },
                    "&:target": { bgcolor: "action.selected" },
                  }}
                >
                  <TableCell scope="row">
                    {sign.name.en} {sign.symbol}
                  </TableCell>

                  <TableCell scope="row">{sign.meaning.en}</TableCell>

                  <TableCell scope="row">
                    {`${day(sign.rulesFrom[0])} – ${day(sign.rulesFrom[1])}`}
                  </TableCell>

                  <TableCell scope="row">
                    {sign.planet && (
                      <Link href={"/astrology/planet/" + sign.planet.id}>
                        {sign.planet.name.en.en}
                      </Link>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    </Container>
  );
}
