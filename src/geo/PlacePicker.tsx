"use client";
import { MyLocation } from "@mui/icons-material";
import {
  Alert,
  Autocomplete,
  type AutocompleteInputChangeReason,
  Box,
  Button,
  Link,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import React from "react";
import { type Place, toPlace } from "@/geo/place";
import { placeKey, placeLabel } from "@/geo/placeLabel";
import usePlace from "@/geo/usePlace";

/** Characters typed before the picker searches. */
export const MIN_QUERY = 2;
/** How long typing must pause before the picker searches. */
export const SEARCH_DEBOUNCE_MS = 250;

/**
 * Where the search is. While `loading`, `places` are the last answer's,
 * kept on show until the new one lands, so the list doesn't empty and flash
 * "Searching…" at every keystroke.
 */
type Search =
  | { state: "idle" }
  | { state: "loading"; places: Place[] }
  | { state: "done"; places: Place[] }
  | { state: "failed" };

const NO_PLACES: Place[] = [];

/** The places on show for a search state. */
const shownPlaces = (search: Search) =>
  search.state === "loading" || search.state === "done"
    ? search.places
    : NO_PLACES;

/**
 * What the picker's polite live region says about a search. MUI's own
 * status sits in the suggestions popup, so it exists only while that is
 * open and never gives a count; the picker's is always there and is the
 * only one, so nothing is announced twice.
 */
function searchStatus(search: Search): string {
  if (search.state === "failed") return "Search needs a connection";
  if (search.state !== "done") return "";
  const count = search.places.length;
  if (count === 0) return "No places found";
  return `${count} ${count === 1 ? "place" : "places"} found`;
}

/**
 * Whether an `onInputChange` reason is the reader's own editing: typing, the
 * clear button, or the text cleared on leaving the field. Not "selectOption"
 * (MUI fills in the chosen option's label, which would then be searched
 * for), nor "reset" (MUI resyncs an unfocused field with the empty value).
 */
export function isReaderEdit(reason: AutocompleteInputChangeReason): boolean {
  return reason === "input" || reason === "clear" || reason === "blur";
}

/** Visually hidden but read by screen readers. */
const visuallyHidden = {
  position: "absolute",
  width: "1px",
  height: "1px",
  padding: 0,
  margin: "-1px",
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
  border: 0,
} as const;

/** `/api/places`'s places for `q`, in its order; throws when it fails. */
async function searchPlaces(q: string, signal: AbortSignal): Promise<Place[]> {
  const response = await fetch(`/api/places?q=${encodeURIComponent(q)}`, {
    signal,
  });
  if (!response.ok) throw new Error(`places: ${response.status}`);
  const body: unknown = await response.json();
  const places =
    typeof body === "object" && body !== null
      ? (body as { places?: unknown }).places
      : undefined;
  if (!Array.isArray(places)) throw new Error("places: not a list");
  return places.map(toPlace).filter((place) => place !== null);
}

/**
 * The places matching what was typed, searched once typing pauses. A search
 * still in flight when the text changes is aborted and its answer ignored,
 * so a late answer for "par" never replaces the one for "paris". A search
 * that failed is tried again when the browser comes back online.
 */
function usePlaceSearch(input: string): Search {
  const query = input.trim();
  const [search, setSearch] = React.useState<Search>({ state: "idle" });
  const [attempt, setAttempt] = React.useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` asks for the search again.
  React.useEffect(() => {
    if (query.length < MIN_QUERY) {
      setSearch({ state: "idle" });
      return;
    }
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setSearch({ state: "failed" });
      return;
    }
    setSearch((was) => ({ state: "loading", places: shownPlaces(was) }));
    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchPlaces(query, controller.signal).then(
        (places) => {
          if (!controller.signal.aborted) setSearch({ state: "done", places });
        },
        () => {
          if (!controller.signal.aborted) setSearch({ state: "failed" });
        },
      );
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, attempt]);

  const failed = search.state === "failed";
  React.useEffect(() => {
    if (!failed) return;
    const retry = () => setAttempt((n) => n + 1);
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [failed]);

  return search;
}

type Locating =
  | { state: "idle" }
  | { state: "locating" }
  | { state: "error"; message: string };

/** What the reader is told when the device can't give its position. */
export const LOCATION_MESSAGES = {
  insecure:
    "Precise location needs a secure (https) connection. Search for a place instead.",
  unsupported:
    "This browser can't give its location. Search for a place instead.",
  denied:
    "Location permission was denied. Allow it in your browser's site settings, or search for a place.",
  unavailable:
    "Your device couldn't find its position. Try again, or search for a place.",
  timeout:
    "Finding your position took too long. Try again, or search for a place.",
} as const;

/** How long the device may take to find its position. */
const POSITION_TIMEOUT_MS = 15_000;

/**
 * Asks the device for its position, only when called (a click), never on
 * load: the browser's permission prompt is off-putting unasked (plan 072).
 */
function locate(
  onPosition: (latitude: number, longitude: number) => void,
  onError: (message: string) => void,
) {
  if (typeof window !== "undefined" && window.isSecureContext === false) {
    onError(LOCATION_MESSAGES.insecure);
    return;
  }
  const geolocation =
    typeof navigator === "undefined" ? undefined : navigator.geolocation;
  if (!geolocation) {
    onError(LOCATION_MESSAGES.unsupported);
    return;
  }
  geolocation.getCurrentPosition(
    (position) =>
      onPosition(position.coords.latitude, position.coords.longitude),
    (error) => {
      // GeolocationPositionError: 1 denied, 2 unavailable, 3 timeout.
      if (error.code === 1) onError(LOCATION_MESSAGES.denied);
      else if (error.code === 3) onError(LOCATION_MESSAGES.timeout);
      else onError(LOCATION_MESSAGES.unavailable);
    },
    {
      enableHighAccuracy: false,
      timeout: POSITION_TIMEOUT_MS,
      maximumAge: 10 * 60_000,
    },
  );
}

/**
 * Choosing the place the hours are counted for (plan 072): a search of the
 * GeoNames cities, the device's precise position on request, and a way back
 * to the place found from the IP.
 *
 * The options are the server's, in its order: `filterOptions` keeps them all,
 * since MUI's own filter would drop a match by another name ("Kiev" finds
 * Kyiv). `onDone` is called once a place is chosen or cleared.
 */
export default function PlacePicker({
  onDone,
  autoFocus = false,
}: {
  onDone?: () => void;
  /** Focus the search when the picker opens at the reader's request. */
  autoFocus?: boolean;
}) {
  const { place, setPlace, clearPlace } = usePlace();
  const [input, setInput] = React.useState("");
  const search = usePlaceSearch(input);
  const [locating, setLocating] = React.useState<Locating>({ state: "idle" });
  const id = React.useId();

  const options = shownPlaces(search);
  const noOptionsText =
    search.state === "failed"
      ? "Search needs a connection"
      : search.state === "done"
        ? "No places found"
        : `Type at least ${MIN_QUERY} letters`;

  // The device's answer can come long after the button is pressed: only the
  // latest request's counts, and none once another place is chosen or the
  // picker is gone.
  const locateRequest = React.useRef(0);
  React.useEffect(
    () => () => {
      locateRequest.current++;
    },
    [],
  );
  const abandonLocating = () => {
    locateRequest.current++;
    setLocating({ state: "idle" });
  };

  const locateDevice = () => {
    const request = ++locateRequest.current;
    const isCurrent = () => request === locateRequest.current;
    setLocating({ state: "locating" });
    locate(
      (latitude, longitude) => {
        if (!isCurrent()) return;
        abandonLocating();
        // The store adds the device's time zone.
        setPlace({ name: "Your location", latitude, longitude }, "device");
        onDone?.();
      },
      (message) => {
        if (isCurrent()) setLocating({ state: "error", message });
      },
    );
  };

  return (
    <Box sx={{ width: "100%" }}>
      <Autocomplete<Place>
        fullWidth
        id={`${id}-search`}
        options={options}
        filterOptions={(x) => x}
        getOptionLabel={placeLabel}
        isOptionEqualToValue={(option, value) =>
          placeKey(option) === placeKey(value)
        }
        value={null}
        inputValue={input}
        onInputChange={(_event, value, reason) => {
          if (isReaderEdit(reason)) setInput(value);
        }}
        onChange={(_event, chosen) => {
          if (!chosen) return;
          abandonLocating();
          setPlace(chosen, "chosen");
          setInput("");
          onDone?.();
        }}
        slotProps={{
          // The picker's own live region below says what this would.
          status: {
            role: undefined,
            "aria-live": undefined,
            "aria-atomic": undefined,
          },
        }}
        loading={search.state === "loading"}
        loadingText="Searching…"
        noOptionsText={noOptionsText}
        renderOption={({ key: _key, ...props }, option) => (
          <li {...props} key={placeKey(option)}>
            {placeLabel(option)}
          </li>
        )}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Find a place"
            placeholder="City or town"
            autoFocus={autoFocus}
          />
        )}
      />
      <Box role="status" aria-live="polite" sx={visuallyHidden}>
        {searchStatus(search)}
      </Box>
      <Stack
        direction="row"
        sx={{ flexWrap: "wrap", gap: 1, mt: 1, alignItems: "center" }}
      >
        <Button
          size="small"
          startIcon={<MyLocation />}
          onClick={locateDevice}
          disabled={locating.state === "locating"}
        >
          {locating.state === "locating"
            ? "Finding your position…"
            : "Use my precise location"}
        </Button>
        {place && place.source !== "ip" ? (
          <Button
            size="small"
            onClick={() => {
              abandonLocating();
              clearPlace();
              onDone?.();
            }}
          >
            Use detected location
          </Button>
        ) : null}
      </Stack>
      {locating.state === "error" ? (
        <Alert severity="warning" sx={{ mt: 1 }}>
          {locating.message}
        </Alert>
      ) : null}
      <Typography
        variant="caption"
        component="p"
        sx={{ mt: 0.5, color: "text.secondary" }}
      >
        Places from <Link href="https://www.geonames.org/">GeoNames</Link> (
        <Link href="https://creativecommons.org/licenses/by/4.0/">
          CC BY 4.0
        </Link>
        )
      </Typography>
    </Box>
  );
}
