import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createSpriteAssetEndpoint,
  createSpriteBaseUrl,
  deleteSpriteAssets,
  prepareSpriteAssetHost,
  publishSpriteAssets,
} from "./sprite-asset-host";

afterEach(() => vi.restoreAllMocks());

describe("sprite asset host", () => {
  it("builds endpoint URLs under the configured Vite base path", () => {
    expect(createSpriteAssetEndpoint("asset-1", "/map-sprite/")).toBe(
      "http://localhost:3000/map-sprite/__map-sprite-test/asset-1",
    );
    expect(createSpriteBaseUrl("asset-1", "/map-sprite/")).toBe(
      "http://localhost:3000/map-sprite/__map-sprite-test/asset-1/sprite",
    );
  });

  it("posts the full sprite payload and reports a failed publish", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response("no", { status: 500 }));
    const payload = {
      spriteJson: { icon: { width: 16, height: 16, x: 0, y: 0, pixelRatio: 1 } },
      retinaJson: { icon: { width: 32, height: 32, x: 0, y: 0, pixelRatio: 2 } },
      spritePngBase64: "AQI=",
      retinaPngBase64: "AwQ=",
    };

    await publishSpriteAssets("asset-1", payload, "/map-sprite/");

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:3000/map-sprite/__map-sprite-test/asset-1",
      expect.objectContaining({ method: "POST" }),
    );
    await expect(publishSpriteAssets("asset-2", payload, "/map-sprite/")).rejects.toThrow(
      "Unable to publish generated sprite assets over HTTP.",
    );
  });

  it("deletes an asset through its base-aware endpoint", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }));

    await deleteSpriteAssets("asset-1", "/map-sprite/");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/map-sprite/__map-sprite-test/asset-1",
      { method: "DELETE" },
    );
  });

  it("registers a root-scoped module worker before production publishing", async () => {
    const registration = {} as ServiceWorkerRegistration;
    const register = vi.fn().mockResolvedValue(registration);
    const serviceWorker = {
      controller: {} as ServiceWorker,
      register,
      ready: Promise.resolve(registration),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as ServiceWorkerContainer;

    await prepareSpriteAssetHost({
      basePath: "/map-sprite/",
      production: true,
      serviceWorker,
    });

    expect(register).toHaveBeenCalledWith("/map-sprite/map-sprite-sw.js", {
      scope: "/map-sprite/",
      type: "module",
    });
  });

  it("explains when a production browser cannot use service workers", async () => {
    await expect(
      prepareSpriteAssetHost({
        production: true,
        serviceWorker: null,
      }),
    ).rejects.toThrow("MapLibre sprite testing requires an active Service Worker in production.");
  });
});
