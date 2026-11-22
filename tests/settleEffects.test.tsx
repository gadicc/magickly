// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { useEffect, useLayoutEffect, useState } from "react";
import { afterEach, expect, it, vi } from "vitest";

afterEach(cleanup);

/** Holds the thread, as a loaded machine does between two tasks. */
const stall = (ms: number) => {
  const until = performance.now() + ms;
  while (performance.now() < until);
};

it("runs a commit's effects before findBy returns, though the thread stalls after it", async () => {
  const mounted = vi.fn();
  function Shown() {
    useLayoutEffect(() => {
      // After the commit, once findBy has seen the text and queued its
      // own timer: the stall lets that timer fall due before React's
      // next task, which is where load put it.
      let later = Promise.resolve();
      for (let hop = 0; hop < 20; hop++) later = later.then(() => {});
      void later.then(() => stall(10));
    }, []);
    useEffect(() => mounted(), []);
    return <p>shown</p>;
  }
  function Later() {
    // Shown outside act, as a fetch or a probe's answer is.
    const [on, setOn] = useState(false);
    useEffect(() => {
      void Promise.resolve().then(() => setOn(true));
    }, []);
    return on ? <Shown /> : null;
  }
  render(<Later />);
  await screen.findByText("shown");
  expect(mounted).toHaveBeenCalledTimes(1);
});
