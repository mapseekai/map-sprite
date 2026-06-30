import { describe, expect, it } from "vitest";
import { parseSvgText } from "./parse-svg";

describe("parseSvgText", () => {
  it("parses width and height attributes first", () => {
    const icon = parseSvgText('<svg width="32" height="24" viewBox="0 0 16 16"></svg>', "a.svg");

    expect(icon.width).toBe(32);
    expect(icon.height).toBe(24);
    expect(icon.name).toBe("a");
  });

  it("parses dimensions from viewBox when width and height are absent", () => {
    const icon = parseSvgText('<svg viewBox="0 0 16 20"></svg>', "b.svg");

    expect(icon.width).toBe(16);
    expect(icon.height).toBe(20);
    expect(icon.viewBox).toBe("0 0 16 20");
  });

  it("parses root style dimensions before falling back to viewBox", () => {
    const icon = parseSvgText(
      '<svg style="width: 20px; height: 30px;" viewBox="0 0 24 24"></svg>',
      "styled.svg",
    );

    expect(icon.width).toBe(20);
    expect(icon.height).toBe(30);
  });

  it("rejects SVG text without usable dimensions", () => {
    expect(() => parseSvgText("<svg></svg>", "bad.svg")).toThrow(/width\/height|viewBox/);
  });

  it.each([
    '<svg width="16" height="16"><script>alert(1)</script></svg>',
    '<svg width="16" height="16" onload="alert(1)"></svg>',
    '<svg width="16" height="16"><foreignObject><div>HTML</div></foreignObject></svg>',
    '<svg width="16" height="16"><image href="https://example.com/icon.png" /></svg>',
    '<svg width="16" height="16"><use xlink:href="javascript:alert(1)" /></svg>',
  ])("rejects unsafe active or external content", (svgText) => {
    expect(() => parseSvgText(svgText, "unsafe.svg")).toThrow(/Unsafe SVG content/);
  });
});
