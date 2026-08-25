import { describe, expect, it } from "vitest";
// @ts-expect-error The public module is intentionally served unchanged by Vite.
import { createSpriteAssetWorkerHandler } from "../public/map-sprite-sw.js";

const scope = "https://example.test/map-sprite/";

function createCacheStorage() {
  const entries = new Map<string, Response>();
  const cache = {
    async put(request: Request, response: Response) {
      entries.set(request.url, response.clone());
    },
    async match(request: Request) {
      return entries.get(request.url)?.clone();
    },
    async delete(request: Request) {
      return entries.delete(request.url);
    },
  };

  return { open: async () => cache };
}

describe("map-sprite service worker", () => {
  it("stores a posted sprite and returns its JSON and PNG files", async () => {
    const handle = createSpriteAssetWorkerHandler({
      cacheStorage: createCacheStorage(),
      scope,
    });
    const endpoint = `${scope}__map-sprite-test/icon-set`;

    const posted = await handle(
      new Request(endpoint, {
        method: "POST",
        body: JSON.stringify({
          spriteJson: { marker: { width: 16, height: 16, x: 0, y: 0, pixelRatio: 1 } },
          retinaJson: { marker: { width: 32, height: 32, x: 0, y: 0, pixelRatio: 2 } },
          spritePngBase64: "AQI=",
          retinaPngBase64: "AwQ=",
        }),
      }),
    );

    expect(posted?.status).toBe(204);
    await expect(
      (await handle(new Request(`${endpoint}/sprite.json`)))?.json(),
    ).resolves.toMatchObject({ marker: { pixelRatio: 1 } });
    await expect(
      (await handle(new Request(`${endpoint}/sprite@2x.png`)))?.arrayBuffer(),
    ).resolves.toEqual(Uint8Array.from([3, 4]).buffer);
  });

  it("rejects invalid input, ignores unrelated requests, and deletes all assets", async () => {
    const handle = createSpriteAssetWorkerHandler({
      cacheStorage: createCacheStorage(),
      scope,
    });
    const endpoint = `${scope}__map-sprite-test/icon-set`;

    expect((await handle(new Request(`${scope}assets/app.js`))) ?? undefined).toBeUndefined();
    expect((await handle(new Request(endpoint, { method: "POST", body: "{}" })))?.status).toBe(400);

    await handle(
      new Request(endpoint, {
        method: "POST",
        body: JSON.stringify({
          spriteJson: {},
          retinaJson: {},
          spritePngBase64: "AQI=",
          retinaPngBase64: "AwQ=",
        }),
      }),
    );

    expect((await handle(new Request(endpoint, { method: "DELETE" })))?.status).toBe(204);
    expect((await handle(new Request(`${endpoint}/sprite.png`)))?.status).toBe(404);
  });
});
