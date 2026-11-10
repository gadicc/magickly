// @vitest-environment jsdom
import { act } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { hydrateAt, renderAt } from "../../tests/hydration";
import usePlace, { CHOSEN_PLACE_KEY, resetPlaceStore } from "./usePlace";

const london = {
  name: "London",
  country: "GB",
  latitude: 51.5085,
  longitude: -0.1257,
};
const time = new Date("2026-11-10T12:00:00Z");

/** Every status a probe rendered, in order. */
let seen: string[] = [];

function Probe() {
  const { status, place } = usePlace();
  seen.push(status);
  return (
    <p>
      {status}
      {place ? `: ${place.name} (${place.source})` : ""}
    </p>
  );
}

let answerGeo: (place: unknown) => void;

beforeEach(() => {
  seen = [];
  localStorage.clear();
  sessionStorage.clear();
  resetPlaceStore();
  vi.stubGlobal(
    "fetch",
    vi.fn(
      () =>
        new Promise((resolve) => {
          answerGeo = (place) =>
            resolve({ ok: true, json: async () => ({ place }) });
        }),
    ),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("prerenders loading, and hydrates a chosen place without a mismatch", async () => {
  const html = renderAt(time, <Probe />);
  expect(html).toBe("<p>loading</p>");

  localStorage.setItem(
    CHOSEN_PLACE_KEY,
    JSON.stringify({ version: 1, source: "chosen", place: london }),
  );
  seen = [];
  const { container, problems, unmount } = await hydrateAt(
    time,
    html,
    <Probe />,
  );
  expect(problems).toEqual([]);
  // The hydrating render matches the HTML; the chosen place is an update.
  expect(seen[0]).toBe("loading");
  expect(container.textContent).toBe("ready: London (chosen)");
  await unmount();
});

it("hydrates loading, then shows the IP's place when the lookup answers", async () => {
  const html = renderAt(time, <Probe />);
  const { container, problems, unmount } = await hydrateAt(
    time,
    html,
    <Probe />,
  );
  expect(problems).toEqual([]);
  expect(container.textContent).toBe("loading");

  await act(async () => {
    answerGeo(london);
    await Promise.resolve();
  });
  expect(container.textContent).toBe("ready: London (ip)");
  await unmount();
});
