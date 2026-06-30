import { describe, expect, it } from "vitest";
import { svgToDataUrl } from "./svg-data-url";

describe("svgToDataUrl", () => {
  it("encodes SVG text as a base64 image data URL", () => {
    const svgText = '<svg width="16" height="16"><title>阀门</title></svg>';
    const prefix = "data:image/svg+xml;base64,";
    const url = svgToDataUrl(svgText);

    expect(url.startsWith(prefix)).toBe(true);

    const bytes = Uint8Array.from(atob(url.slice(prefix.length)), (character) =>
      character.charCodeAt(0),
    );
    expect(new TextDecoder().decode(bytes)).toBe(svgText);
  });
});
