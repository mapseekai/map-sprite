import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { exportSpriteZip } from "./export-zip";
import { createSprite } from "./pack";
import { parseSvgText } from "./parse-svg";
import type { RenderSpriteOptions, SpriteJson } from "./types";

describe("MapLibre / Mapbox sprite compatibility", () => {
  it("exports sprite assets that a style can reference with icon-image", async () => {
    const icon = parseSvgText(
      '<svg width="32" height="32" viewBox="0 0 32 32"></svg>',
      "Gas Valve.svg",
    );
    const sprite = createSprite([icon]);
    const iconName = "gas-valve";
    const spriteBaseUrl = "http://127.0.0.1:5173/sprites/demo/sprite";
    const style = {
      version: 8,
      sprite: spriteBaseUrl,
      sources: {
        test: {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                geometry: {
                  type: "Point",
                  coordinates: [116.397, 39.908],
                },
                properties: {},
              },
            ],
          },
        },
      },
      layers: [
        {
          id: "test-icon",
          type: "symbol",
          source: "test",
          layout: {
            "icon-image": iconName,
            "icon-size": 1,
            "icon-allow-overlap": true,
          },
        },
      ],
    };

    expect(style.sprite).toBe(spriteBaseUrl);
    expect(style.sprite).not.toMatch(/@2x|\.(json|png)$/);
    expect(sprite.json[style.layers[0].layout["icon-image"]]).toBeTruthy();

    const zipBlob = await exportSpriteZip(sprite, { renderPng: fakePngRenderer });
    const zip = await JSZip.loadAsync(zipBlob);

    expect(zip.file("sprite.png")).toBeTruthy();
    expect(zip.file("sprite.json")).toBeTruthy();
    expect(zip.file("sprite@2x.png")).toBeTruthy();
    expect(zip.file("sprite@2x.json")).toBeTruthy();

    const spriteJson = JSON.parse(await zip.file("sprite.json")!.async("text")) as SpriteJson;
    const retinaJson = JSON.parse(await zip.file("sprite@2x.json")!.async("text")) as SpriteJson;

    expect(spriteJson[iconName]).toMatchObject({
      width: 32,
      height: 32,
      pixelRatio: 1,
    });
    expect(retinaJson[iconName]).toMatchObject({
      width: 64,
      height: 64,
      pixelRatio: 2,
    });
  });
});

async function fakePngRenderer(_sprite: unknown, options?: RenderSpriteOptions): Promise<Blob> {
  return new Blob([`png-${options?.pixelRatio ?? 1}`], { type: "image/png" });
}
