"use client";
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
import PlaceChooser from "@/geo/PlaceChooser";
import PlacePicker from "@/geo/PlacePicker";
import { placeLabel } from "@/geo/placeLabel";
import { timeZoneNote } from "@/geo/timeZone";
import usePlace, { type SourcedPlace } from "@/geo/usePlace";
import OpenSource from "@/OpenSource";
import {
  calcPlanetaryHoursForDayAndLocation,
  DAY_IN_MS,
  hourEnd,
  type PlanetaryDay,
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

// What the page says for a day on which the sun does not cross the horizon
// (inside the polar circles), and under a day whose night has no sunrise to
// end it.
const NO_SUNRISE = "The sun does not rise here on this day.";
const NO_SUNSET = "The sun does not set here on this day.";
const NO_NIGHT_HOURS =
  "This night has no hours here, since the sun neither rises nor sets the next day.";

function PlanetaryHoursForDay({
  day,
  planet,
}: {
  day: PlanetaryDay;
  planet: string;
}) {
  if (day.kind === "polarNight") return <p>{NO_SUNRISE}</p>;
  if (day.kind === "midnightSun") return <p>{NO_SUNSET}</p>;

  const { hours, meta } = day;
  const now = new Date();
  const isNow = (i: number) => now > hours[i].date && now < hourEnd(day, i);

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
                  (theme) =>
                    theme.applyStyles("dark", {
                      background:
                        hour.planet === planet
                          ? "rgba(204, 204, 85, 0.3)"
                          : i >= 12
                            ? "rgba(0, 0, 0, 0.35)"
                            : "",
                    }),
                  isNow(i) && sxNowRow,
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
      <br />1 daytime hour = {meta.dayHourInMinutes.toFixed(2)} minutes
      <br />
      {meta.nightHourInMinutes === null ? (
        NO_NIGHT_HOURS
      ) : (
        <>1 nighttime hour = {meta.nightHourInMinutes.toFixed(2)} minutes</>
      )}
      <br />
    </div>
  );
}

/**
 * The place the hours are for, with its coordinates and a way to change it,
 * and a note when its clock differs from the device's, on which the times
 * are shown.
 */
function PlaceLine({
  place,
  week,
  focusOnMount,
}: {
  place: SourcedPlace;
  week: PlanetaryDay[];
  /** Focus its button: the place was just chosen in the picker it replaces. */
  focusOnMount: boolean;
}) {
  const note = timeZoneNote(
    place,
    week.flatMap((day) =>
      day.kind === "hours" ? day.hours.map((hour) => hour.date) : [],
    ),
  );
  return (
    <>
      <PlaceChooser
        focusOnMount={focusOnMount}
        summary={
          <>
            {placeLabel(place)}{" "}
            <span style={{ color: "#aaa" }}>
              ({place.latitude.toFixed(3)}, {place.longitude.toFixed(3)})
            </span>
          </>
        }
      />
      {note ? (
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          {note}
        </Typography>
      ) : null}
    </>
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
  /** Each planet's `keyOfSolomon.en`, Mathers' sentence on its days and hours. */
  keyOfSolomon: Record<HourPlanet, string>;
}) {
  const { status, place } = usePlace();
  const [planet, setPlanet] = React.useState("");
  // Set when a place is chosen in the picker shown for an unknown location:
  // the place line replaces that picker, and takes the focus it held.
  const [chosenHere, setChosenHere] = React.useState(false);
  const [_upcomingHours, setUpcomingHours] = React.useState<
    { from: Date; to: Date }[]
  >([]);

  React.useEffect(() => {
    if (!place) return;
    setUpcomingHours(upcomingHoursForPlanetAtLocation(planet, place));
  }, [place, planet]);

  if (!place) {
    return (
      <Container sx={{ my: 1 }}>
        {status === "loading" ? (
          <Box sx={{ my: 2 }} role="status">
            Finding your location…
          </Box>
        ) : (
          <Box sx={{ my: 2 }}>
            <Typography sx={{ mb: 2 }}>
              Your location couldn&apos;t be found. Choose a place to see its
              planetary hours.
            </Typography>
            <PlacePicker onDone={() => setChosenHere(true)} />
          </Box>
        )}
      </Container>
    );
  }

  // Steps of exactly 24 hours give consecutive solar days at the place.
  const now = new Date();
  const week = [0, 1, 2, 3, 4, 5, 6].map((d) =>
    calcPlanetaryHoursForDayAndLocation(
      new Date(now.getTime() + d * DAY_IN_MS),
      place,
    ),
  );

  const planetSelect = SELECT_ORDER.map((value) => ({
    value,
    label: keyOfSolomon[value],
  }));

  return (
    <Container sx={{ my: 1 }}>
      <Box sx={{ my: 2 }}>
        <PlaceLine place={place} week={week} focusOnMount={chosenHere} />
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
        {week.map((day, i) => (
          <Accordion key={i} defaultExpanded={i === 0}>
            <AccordionSummary
              expandIcon={<ExpandMore />}
              sx={
                {
                  // "& .MuiAccordionSummary-content": { margin: 0 },
                }
              }
            >
              <Typography>{format(day.solarDate, "cccc (LLL d)")}</Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0, m: 0 }}>
              <PlanetaryHoursForDay day={day} planet={planet} />
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
