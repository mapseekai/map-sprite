import { afterEach, describe, expect, it, vi } from "vitest";
import type { SpriteResult } from "../../../src";

const doubles = vi.hoisted(() => ({
  createRetinaSpriteJson: vi.fn(() => ({
    icon: { width: 32, height: 32, x: 0, y: 0, pixelRatio: 2 },
  })),
  renderSpritePng: vi.fn(async () => new Blob(["png"], { type: "image/png" })),
  createSpriteBaseUrl: vi.fn(() => "http://localhost:3000/map-sprite/__map-sprite-test/id/sprite"),
  prepareSpriteAssetHost: vi.fn(async () => undefined),
  publishSpriteAssets: vi.fn(async () => undefined),
}));

vi.mock("../../../src", () => ({
  createRetinaSpriteJson: doubles.createRetinaSpriteJson,
  renderSpritePng: doubles.renderSpritePng,
}));
vi.mock("./sprite-asset-host", () => ({
  createSpriteBaseUrl: doubles.createSpriteBaseUrl,
  prepareSpriteAssetHost: doubles.prepareSpriteAssetHost,
  publishSpriteAssets: doubles.publishSpriteAssets,
  deleteSpriteAssets: vi.fn(),
}));

import { createSpriteBundle } from "./MapLibreSpriteTest";

afterEach(() => vi.clearAllMocks());

describe("createSpriteBundle", () => {
  it("publishes generated images before returning the MapLibre sprite URL", async () => {
    const sprite: SpriteResult = {
      width: 16,
      height: 16,
      icons: [
        {
          id: "icon",
          name: "icon",
          fileName: "icon.svg",
          svgText: '<svg width="16" height="16" />',
          width: 16,
          height: 16,
          sourceWidth: 16,
          sourceHeight: 16,
          rotation: 0,
          x: 0,
          y: 0,
        },
      ],
      json: { icon: { width: 16, height: 16, x: 0, y: 0, pixelRatio: 1 } },
    };

    const bundle = await createSpriteBundle(sprite);

    expect(doubles.prepareSpriteAssetHost).toHaveBeenCalledOnce();
    expect(doubles.publishSpriteAssets).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        spriteJson: sprite.json,
        retinaJson: { icon: { width: 32, height: 32, x: 0, y: 0, pixelRatio: 2 } },
      }),
    );
    expect(bundle.spriteBaseUrl).toBe(
      "http://localhost:3000/map-sprite/__map-sprite-test/id/sprite",
    );
  });
});
