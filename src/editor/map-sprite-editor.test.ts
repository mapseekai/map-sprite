import { describe, expect, it, vi } from "vitest";
import { MapSpriteEditor } from "./map-sprite-editor";
import type { SvgIconInput } from "../core";

function testIcon(id: string): SvgIconInput {
  return {
    id,
    name: id,
    fileName: `${id}.svg`,
    svgText: '<svg width="16" height="16"></svg>',
    width: 16,
    height: 16,
  };
}

describe("MapSpriteEditor", () => {
  it("does not expose the internal icons array from getState", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    const container = document.createElement("div");
    const editor = new MapSpriteEditor({
      container,
      icons: [testIcon("first")],
    });

    editor.getState().icons.push(testIcon("external"));

    expect(editor.getState().icons).toHaveLength(1);
    expect(editor.getState().icons[0]?.id).toBe("first");
  });

  it("does not retain the caller-owned array passed to setIcons", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    const container = document.createElement("div");
    const editor = new MapSpriteEditor({
      container,
      icons: [testIcon("initial")],
    });
    const nextIcons = [testIcon("next")];

    editor.setIcons(nextIcons);
    nextIcons.push(testIcon("external"));

    expect(editor.getState().icons).toHaveLength(1);
    expect(editor.getState().icons[0]?.id).toBe("next");
  });

  it("renders stable controls and sanitized icon thumbnails", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    const container = document.createElement("div");

    new MapSpriteEditor({
      container,
      icons: [testIcon("control")],
      logic: "max-area",
      padding: 6,
      preserveOrder: false,
    });

    expect(container.querySelector<HTMLSelectElement>(".mse-logic")?.value).toBe("max-area");
    expect(container.querySelector<HTMLInputElement>(".mse-gap")?.value).toBe("6");
    expect(container.querySelector<HTMLInputElement>(".mse-preserve-order")?.checked).toBe(false);
    expect(container.querySelector(".mse-thumb svg")).toBeNull();
    expect(container.querySelector(".mse-thumb img")).toBeTruthy();
  });

  it("does not inject raw SVG markup into the icon list", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    const container = document.createElement("div");

    new MapSpriteEditor({
      container,
      icons: [
        {
          id: "malicious",
          name: "malicious",
          fileName: "malicious.svg",
          svgText:
            '<svg width="16" height="16" onload="window.__xss = true"><script>window.__xss = true</script><foreignObject><div>unsafe</div></foreignObject></svg>',
          width: 16,
          height: 16,
        },
      ],
    });

    const thumb = container.querySelector(".mse-thumb");
    const image = thumb?.querySelector("img");

    expect(image?.getAttribute("src")).toMatch(/^data:image\/svg\+xml;base64,/);
    expect(thumb?.querySelector("svg")).toBeNull();
    expect(container.innerHTML).not.toContain("<script");
    expect(container.innerHTML).not.toContain("onload");
    expect(container.innerHTML).not.toContain("foreignObject");
  });
});
