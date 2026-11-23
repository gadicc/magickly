// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { renderWithShare } from "../../tests/pageShare";
import { type PageShare, usePageShare, useSharedPage } from "./pageShare";

afterEach(cleanup);

function Page({ share }: { share?: PageShare }) {
  usePageShare(share);
  return null;
}

describe("the page-share context", () => {
  it("gives Share the mounted page's latest builder, and lets go on unmount", () => {
    const { shared, rerender } = renderWithShare(
      <Page share={{ url: () => "/a?x=1", personal: true }} />,
    );
    expect(shared()?.url()).toBe("/a?x=1");
    expect(shared()?.personal).toBe(true);
    rerender(<Page share={{ url: () => "/a?x=2", personal: false }} />);
    expect(shared()?.url()).toBe("/a?x=2");
    expect(shared()?.personal).toBe(false);
    rerender(<span />);
    expect(shared()).toBeNull();
  });

  it("follows a page's state between renders, without re-rendering others", () => {
    let others = 0;
    function Other() {
      others++;
      useSharedPage();
      return null;
    }
    function Counter() {
      const [n, setN] = React.useState(0);
      usePageShare({ url: () => `/count?n=${n}`, personal: false });
      return (
        <button type="button" onClick={() => setN(n + 1)}>
          more
        </button>
      );
    }
    const { shared, getByRole } = renderWithShare(
      <>
        <Other />
        <Counter />
      </>,
    );
    const before = others;
    fireEvent.click(getByRole("button", { name: /more|toggle/ }));
    fireEvent.click(getByRole("button", { name: /more|toggle/ }));
    expect(shared()?.url()).toBe("/count?n=2");
    expect(others).toBe(before);
  });

  it("leaves the bare page while a page registers nothing", () => {
    function Maybe() {
      const [on, setOn] = React.useState(false);
      usePageShare(on ? { url: () => "/sigil", personal: true } : undefined);
      return (
        <button type="button" onClick={() => setOn(!on)}>
          toggle
        </button>
      );
    }
    const { shared, getByRole } = renderWithShare(<Maybe />);
    expect(shared()).toBeNull();
    fireEvent.click(getByRole("button", { name: /more|toggle/ }));
    expect(shared()?.url()).toBe("/sigil");
    fireEvent.click(getByRole("button", { name: /more|toggle/ }));
    expect(shared()).toBeNull();
  });

  it("does nothing outside a provider", () => {
    let read: () => PageShare | null = () => ({
      url: () => "",
      personal: false,
    });
    function Probe() {
      read = useSharedPage();
      usePageShare({ url: () => "/x", personal: false });
      return null;
    }
    render(<Probe />);
    expect(read()).toBeNull();
  });
});
