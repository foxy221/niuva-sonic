import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import Visualizer, { BRAND_PALETTE } from "../src/components/Visualizer";

function mockMatchMedia(reduce) {
  vi.stubGlobal("matchMedia", (query) => ({ matches: reduce && query.includes("reduce"), media: query, addEventListener() {}, removeEventListener() {} }));
}

describe("Visualizer", () => {
  let raf;
  beforeEach(() => {
    raf = vi.fn(() => 1);
    vi.stubGlobal("requestAnimationFrame", raf);
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("zeichnet bei reduzierter Bewegung einmal und plant keine Folgebilder", () => {
    mockMatchMedia(true);
    render(<Visualizer anchor={{ current: null }} />);
    raf.mock.calls[0][0](performance.now());
    expect(raf).toHaveBeenCalledTimes(1);
  });

  it("läuft ohne Einschränkung weiter", () => {
    mockMatchMedia(false);
    render(<Visualizer anchor={{ current: null }} />);
    raf.mock.calls[0][0](performance.now());
    expect(raf).toHaveBeenCalledTimes(2);
  });

  it("nutzt ohne Cover die Logo-Farben", () => {
    mockMatchMedia(false);
    const { container } = render(<Visualizer anchor={{ current: null }} />);
    const root = container.querySelector(".full-viz");
    expect(root.style.getPropertyValue("--viz-b")).toBe(BRAND_PALETTE[1]);
    expect(root.style.getPropertyValue("--viz-c")).toBe(BRAND_PALETTE[2]);
  });
});
