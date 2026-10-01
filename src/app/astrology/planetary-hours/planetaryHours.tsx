"use client";
import useGeoIP from "@magick-components/hooks/useGeoIP";
import { ExpandMore } from "@mui/icons-material";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Container,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  SelectChangeEvent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Typography,
} from "@mui/material";
import { format } from "date-fns";
import React from "react";
import OpenSource from "@/OpenSource";
import {
  calcPlanetaryHoursForDayAndLocation,
  DAY_IN_MS,
  upcomingHoursForPlanetAtLocation,
} from "./utils";

const sxNowRow = {
  "& .MuiTableCell-root": {
    fontWeight: "bold",
    borderTop: "1.5px solid red",
    borderBottom: "1.5px solid red",
    // borderCollapse: "separate",
  },
  "& .MuiTableCell-root:first-of-type": {
    borderLeft: "1.5px solid red",
  },
  "& .MuiTableCell-root:last-child": {
    borderRight: "1.5px solid red",
  },
};

function PlanetaryHoursForDayAndLocation({ date, geo, planet }) {
  const hours = calcPlanetaryHoursForDayAndLocation(date, geo);
  const now = new Date();
  function isNow(hour, i) {
    const hourInMinutes =
      hours.meta[i < 12 ? "dayHourInMinutes" : "nightHourInMinutes"];
    return (
      now > hour.date &&
      now.getTime() < hour.date.getTime() + hourInMinutes * 60_000
    );
  }

  return (
    <div>
      <TableContainer component={Paper} sx={{ mt: 1 }}>
        <Table size="small" aria-label="simple table">
          <TableBody>
            {hours.map((hour, i) => (
              <TableRow
                key={i}
                sx={[
                  {
                    background:
                      hour.planet === planet ? "#cc5" : i >= 12 ? "#ccc" : "",
                  },
                  isNow(hour, i) && sxNowRow,
                ]}
              >
                <TableCell>{(i % 12) + 1}</TableCell>
                <TableCell>{format(hour.date, "HH:mm")}</TableCell>
                <TableCell>
                  {hour.planet[0].toUpperCase() + hour.planet.substring(1)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <br />1 daytime hour = {hours.meta.dayHourInMinutes.toFixed(2)} minutes
      <br />1 nighttime hour = {hours.meta.nightHourInMinutes.toFixed(2)}{" "}
      minutes
      <br />
    </div>
  );
}

/**
 * The seven planets of the hours, in the Chaldean order from Sol, as the
 * select has always listed them.
 */
const SELECT_ORDER = [
  "sol",
  "venus",
  "mercury",
  "luna",
  "saturn",
  "jupiter",
  "mars",
] as const;

/** One of the seven planets the hours cycle through. */
export type HourPlanet = (typeof SELECT_ORDER)[number];

/**
 * The planetary hours, with a select of the seven planets that each gives
 * what the Key of Solomon says its days and hours serve for.
 *
 * The texts are the planet data's `keyOfSolomon`, which the server page reads
 * and passes down, so that this client component imports no data table and
 * its bundle carries none.
 */
export default function PlanetaryHours({
  keyOfSolomon,
}: {
  /** Each planet's `keyOfSolomon.en`, a fragment that follows its name. */
  keyOfSolomon: Record<HourPlanet, string>;
}) {
  const geo = useGeoIP();
  const [planet, setPlanet] = React.useState("");
  const [_upcomingHours, setUpcomingHours] = React.useState<
    { from: Date; to: Date }[]
  >([]);

  React.useEffect(() => {
    if (!geo) return;
    setUpcomingHours(upcomingHoursForPlanetAtLocation(planet, geo));
  }, [geo, planet]);

  if (!geo) return "Loading location...";

  const now = new Date();
  const week = [0, 1, 2, 3, 4, 5, 6].map(
    (d, i) => new Date(now.getTime() + d * DAY_IN_MS),
  );

  const planetSelect = SELECT_ORDER.map((value) => ({
    value,
    label: keyOfSolomon[value],
  }));

  return (
    <Container sx={{ my: 1 }}>
      <Box sx={{ my: 2 }}>
        {geo.city}, {geo.country}{" "}
        <span style={{ color: "#aaa" }}>
          ({geo.longitude}, {geo.latitude})
        </span>
      </Box>
      <FormControl fullWidth>
        <InputLabel id="select-planet-label">Planet</InputLabel>
        <Select
          label="Planet"
          id="select-planet"
          labelId="select-planet-label"
          value={planet}
          onChange={(event: SelectChangeEvent) => setPlanet(event.target.value)}
        >
          {planetSelect.map((ps) => (
            <MenuItem key={ps.value} value={ps.value}>
              <div
                style={{
                  textAlign: "center",
                  width: "100%",
                  whiteSpace: "normal",
                }}
              >
                <b>{ps.value[0].toUpperCase() + ps.value.substring(1)}</b>:{" "}
                {ps.label}
              </div>
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      {/* planet && <UpcomingHours hours={upcomingHours} /> */}
      <Box sx={{ mt: 1 }}>
        {week.map((date, i) => (
          <Accordion key={i} defaultExpanded={i === 0}>
            <AccordionSummary
              expandIcon={<ExpandMore />}
              sx={
                {
                  // "& .MuiAccordionSummary-content": { margin: 0 },
                }
              }
            >
              <Typography>{format(date, "cccc (LLL d)")}</Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0, m: 0 }}>
              <PlanetaryHoursForDayAndLocation
                date={date}
                geo={geo}
                planet={planet}
              />
            </AccordionDetails>
          </Accordion>
        ))}
      </Box>
      <br />
      <Box>
        Planetary influences sourced from The Key of Solomon,{" "}
        <a href="https://sacred-texts.com/grim/kos/kos07.htm">chapter 2</a>{" "}
        (MacGregor Mathers, 1888).
      </Box>
      <OpenSource
        files={[
          "/src/app/astrology/planetary-hours/planetaryHours.tsx",
          "/src/app/astrology/planetary-hours/utils.tsx",
        ]}
      />
    </Container>
  );
}
