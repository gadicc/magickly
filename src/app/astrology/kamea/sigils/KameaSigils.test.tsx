// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import KameaSigils from "./KameaSigils";
import { DEFAULT_KAMEA_SIGIL } from "./kameaSigilState";
import { serverSeed } from "./serverSeed";

afterEach(cleanup);

/** The drawing's accessible name, once its figure is placed. */
const drawing = (name: string) => screen.findByRole("img", { name });

const imageLink = () =>
  screen
    .getAllByRole("link", { name: "Open SVG image link" })[0]
    .getAttribute("href") ?? "";

/** The reduction table's rows, as "letter number cell". */
const rows = () =>
  [...document.querySelectorAll("table tbody tr")].map((row) =>
    [...row.querySelectorAll("td")].map((cell) => cell.textContent).join(" "),
  );

describe("/astrology/kamea/sigils", () => {
  it("draws Agiel on Saturn's square with its reduction and image links", async () => {
    render(<KameaSigils initial={DEFAULT_KAMEA_SIGIL} />);
    await drawing("Sigil of אגיאל on the Kamea of Saturn");
    expect(rows()).toEqual(["א 1 1", "ג 3 3", "י 10 1", "א 1 1", "ל 30 3"]);
    await waitFor(() =>
      expect(imageLink()).toBe(
        `/api/render/kamea-sigil?${new URLSearchParams({ planet: "saturn", text: "אגיאל" })}`,
      ),
    );
    expect(
      screen.getByText(
        "Links include what you entered here. Share them only when you mean to.",
      ),
    ).toBeTruthy();
    // The figure is drawn at its square's least legible size or larger.
    const figure = document.querySelector(
      "svg[data-placement], [role=img] svg",
    );
    expect(Number(figure?.getAttribute("width"))).toBeGreaterThanOrEqual(240);
  });

  it("draws the server's seed at once, with nothing placing", () => {
    render(
      <KameaSigils
        initial={DEFAULT_KAMEA_SIGIL}
        seed={serverSeed(DEFAULT_KAMEA_SIGIL)}
      />,
    );
    // Synchronously: no pause, no placement, no dimming.
    const figure = screen.getByRole("img", {
      name: "Sigil of אגיאל on the Kamea of Saturn",
    });
    expect(figure.getAttribute("class")).not.toMatch(/stale/);
    expect(screen.queryByText("Placing the sigil…")).toBeNull();
    expect(screen.getByRole("status").textContent).toBe(
      "Sigil of אגיאל on the Kamea of Saturn",
    );
  });

  it("shows a shared text's bare square, not placing, until the client starts", () => {
    render(
      <KameaSigils
        initial={{ planet: "mars", text: "גדי", finals: false }}
        seed={serverSeed({ planet: "mars", text: "גדי", finals: false })}
      />,
    );
    const square = screen.getByRole("img", { name: "Kamea of Mars" });
    expect(square.getAttribute("class")).not.toMatch(/stale/);
    expect(screen.queryByText("Placing the sigil…")).toBeNull();
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("counts finals only when asked, and links the choice", async () => {
    render(
      <KameaSigils initial={{ planet: "luna", text: "אלים", finals: false }} />,
    );
    await drawing("Sigil of אלים on the Kamea of the Moon");
    expect(rows().at(-1)).toBe("ם 40 40");
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Count final letters at 500 to 900",
      }),
    );
    expect(rows().at(-1)).toBe("ם 600 60");
    await waitFor(() => expect(imageLink()).toContain("finals=true"));
  });

  it("traces a name chosen from the planet's list, and another planet's square", async () => {
    render(<KameaSigils initial={DEFAULT_KAMEA_SIGIL} />);
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Planet" }));
    fireEvent.click(screen.getByRole("option", { name: "Mercury" }));
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Names" }));
    fireEvent.click(
      screen.getByRole("option", { name: "Taphthartharath תפתרתרת" }),
    );
    expect(
      (screen.getByRole("textbox", { name: "Hebrew name" }) as HTMLInputElement)
        .value,
    ).toBe("תפתרתרת");
    await drawing("Sigil of תפתרתרת on the Kamea of Mercury");
    expect(rows().map((row) => row.split(" ")[2])).toEqual([
      "40",
      "8",
      "40",
      "20",
      "40",
      "20",
      "40",
    ]);
  });

  it("marks what it cannot trace and offers no link for it", async () => {
    render(<KameaSigils initial={DEFAULT_KAMEA_SIGIL} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Hebrew name" }), {
      target: { value: "אגיאל1" },
    });
    expect(screen.getByText("Only Hebrew letters can be traced:")).toBeTruthy();
    expect(
      screen.queryAllByRole("link", { name: "Open SVG image link" }),
    ).toEqual([]);
    fireEvent.change(screen.getByRole("textbox", { name: "Hebrew name" }), {
      target: { value: "א".repeat(33) },
    });
    expect(
      screen.getByText("A sigil takes at most 32 letters; this text has 33."),
    ).toBeTruthy();
  });

  it("says when a name cannot be drawn with every mark clear", async () => {
    // 777's Malcha with finals: placement leaves it failing (plan 093, K3).
    render(
      <KameaSigils
        initial={{
          planet: "luna",
          text: "מלכא בתרשישים ועד ברוח שחקים",
          finals: true,
        }}
      />,
    );
    expect(
      await screen.findByText(
        /could not be drawn so that every mark stands clear/,
        undefined,
        { timeout: 30_000 },
      ),
    ).toBeTruthy();
    expect(
      document.querySelector('[role="img"][data-placement="failed"]'),
    ).toBeTruthy();
    // Five words, five tables of letters.
    expect(document.querySelectorAll("table tbody")).toHaveLength(5);
  }, 60_000);
});
