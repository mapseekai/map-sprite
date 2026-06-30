import { describe, expect, it } from "vitest";
import { createSprite, resolveSpriteOptions } from "./pack";
import { createRetinaSpriteJson } from "./sprite-json";
import type { SvgIconInput } from "./types";

describe("createSprite", () => {
  it("packs icons and creates standard sprite JSON", () => {
    const sprite = createSprite([icon("valve", 32, 32), icon("alarm", 24, 24)]);

    expect(sprite.width).toBeGreaterThanOrEqual(32);
    expect(sprite.height).toBeGreaterThanOrEqual(32);
    expect(sprite.json.valve).toMatchObject({
      width: 32,
      height: 32,
      pixelRatio: 1,
    });
    expect(Number.isFinite(sprite.json.valve.x)).toBe(true);
    expect(Number.isFinite(sprite.json.valve.y)).toBe(true);
  });

  it("uses the later icon when names collide", () => {
    const sprite = createSprite([
      icon("valve", 16, 16, "old.svg"),
      icon("valve", 20, 20, "new.svg"),
    ]);

    expect(sprite.icons).toHaveLength(1);
    expect(sprite.icons[0].fileName).toBe("new.svg");
    expect(sprite.json.valve.width).toBe(20);
  });

  it("creates retina JSON scaled to pixel ratio 2", () => {
    const sprite = createSprite([icon("valve", 16, 10)]);
    const retinaJson = createRetinaSpriteJson(sprite);

    expect(retinaJson.valve).toEqual({
      width: sprite.json.valve.width * 2,
      height: sprite.json.valve.height * 2,
      x: sprite.json.valve.x * 2,
      y: sprite.json.valve.y * 2,
      pixelRatio: 2,
    });
  });

  it("uses rotated bounds in packed icons and sprite JSON", () => {
    const sprite = createSprite([{ ...icon("meter", 20, 30), rotation: 90 }]);

    expect(sprite.icons[0]).toMatchObject({
      sourceWidth: 20,
      sourceHeight: 30,
      width: 30,
      height: 20,
      rotation: 90,
    });
    expect(sprite.json.meter).toMatchObject({
      width: 30,
      height: 20,
      pixelRatio: 1,
    });
  });

  it("rejects rotation in options", () => {
    expect(() => resolveSpriteOptions({ allowRotation: true as false })).toThrow(/rotation/i);
  });

  it("accepts supported packing logic options", () => {
    expect(resolveSpriteOptions({ logic: "max-edge" }).logic).toBe("max-edge");
    expect(resolveSpriteOptions({ logic: "max-area" }).logic).toBe("max-area");

    const edgeSprite = createSprite([icon("wide", 40, 12), icon("tall", 12, 40)], {
      logic: "max-edge",
    });
    const areaSprite = createSprite([icon("wide", 40, 12), icon("tall", 12, 40)], {
      logic: "max-area",
    });

    expect(edgeSprite.json.wide.pixelRatio).toBe(1);
    expect(areaSprite.json.wide.pixelRatio).toBe(1);
  });

  it("can preserve caller order when packing icons", () => {
    const sprite = createSprite([icon("small", 10, 10), icon("large", 30, 30)], {
      preserveOrder: true,
    });

    expect(sprite.icons.map((packedIcon) => packedIcon.name)).toEqual(["small", "large"]);
    expect(Object.keys(sprite.json)).toEqual(["small", "large"]);
  });

  it("searches compact layouts when caller order is not preserved", () => {
    const sprite = createSprite(
      [
        icon("wide-a", 80, 30),
        icon("wide-b", 80, 30),
        icon("tall-a", 30, 80),
        icon("tall-b", 30, 80),
        icon("square", 50, 50),
      ],
      {
        preserveOrder: false,
      },
    );

    expect(sprite.width * sprite.height).toBeLessThan(19564);
  });

  it("rejects sprites that would exceed configured final bounds after border is applied", () => {
    expect(() =>
      createSprite([icon("exact", 80, 30)], {
        maxWidth: 80,
        maxHeight: 30,
      }),
    ).toThrow(/single sprite/);

    const sprite = createSprite([icon("exact", 80, 30)], {
      maxWidth: 82,
      maxHeight: 32,
    });

    expect(sprite.width).toBeLessThanOrEqual(82);
    expect(sprite.height).toBeLessThanOrEqual(32);
  });
});

function icon(name: string, width: number, height: number, fileName = `${name}.svg`): SvgIconInput {
  return {
    id: `${name}-${width}-${height}`,
    name,
    fileName,
    svgText: `<svg width="${width}" height="${height}"></svg>`,
    width,
    height,
  };
}
