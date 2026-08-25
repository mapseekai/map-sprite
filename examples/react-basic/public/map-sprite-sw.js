const cacheName = "map-sprite-generated-assets-v1";
const assetPrefix = "__map-sprite-test/";

export function createSpriteAssetWorkerHandler({ cacheStorage, scope }) {
  const endpointRoot = new URL(assetPrefix, scope);

  return async function handle(request) {
    const url = new URL(request.url);
    if (!isSpriteAssetRequest(url, endpointRoot)) {
      return undefined;
    }
    if (request.method === "OPTIONS") {
      return emptyResponse(204);
    }

    const relativePath = url.pathname.slice(endpointRoot.pathname.length);
    const mutation = /^([^/]+)$/.exec(relativePath);
    const asset = /^([^/]+)\/sprite(@2x)?\.(json|png)$/.exec(relativePath);

    if (mutation && request.method === "POST") {
      return storePayload(request, mutation[1]);
    }
    if (mutation && request.method === "DELETE") {
      return deletePayload(mutation[1]);
    }
    if (asset && request.method === "GET") {
      return getPayload(request);
    }
    return textResponse(404, "Not found");
  };

  function assetUrl(assetId, fileName) {
    return new Request(new URL(`${encodeURIComponent(assetId)}/${fileName}`, endpointRoot));
  }

  async function storePayload(request, assetId) {
    const payload = await parsePayload(request);
    if (!payload) {
      return textResponse(400, "Invalid generated sprite payload");
    }

    try {
      const cache = await cacheStorage.open(cacheName);
      await Promise.all([
        cache.put(assetUrl(assetId, "sprite.json"), jsonResponse(payload.spriteJson)),
        cache.put(assetUrl(assetId, "sprite.png"), pngResponse(payload.spritePngBase64)),
        cache.put(assetUrl(assetId, "sprite@2x.json"), jsonResponse(payload.retinaJson)),
        cache.put(assetUrl(assetId, "sprite@2x.png"), pngResponse(payload.retinaPngBase64)),
      ]);
    } catch {
      return textResponse(400, "Invalid generated sprite payload");
    }

    return emptyResponse(204);
  }

  async function getPayload(request) {
    const cache = await cacheStorage.open(cacheName);
    const response = await cache.match(request);

    return response ?? textResponse(404, "Generated sprite asset was not found");
  }

  async function deletePayload(assetId) {
    const cache = await cacheStorage.open(cacheName);
    await Promise.all([
      cache.delete(assetUrl(assetId, "sprite.json")),
      cache.delete(assetUrl(assetId, "sprite.png")),
      cache.delete(assetUrl(assetId, "sprite@2x.json")),
      cache.delete(assetUrl(assetId, "sprite@2x.png")),
    ]);

    return emptyResponse(204);
  }
}

async function parsePayload(request) {
  try {
    const payload = JSON.parse(await request.text());
    if (
      !isRecord(payload) ||
      !isRecord(payload.spriteJson) ||
      !isRecord(payload.retinaJson) ||
      typeof payload.spritePngBase64 !== "string" ||
      typeof payload.retinaPngBase64 !== "string"
    ) {
      return undefined;
    }

    return payload;
  } catch {
    return undefined;
  }
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSpriteAssetRequest(url, endpointRoot) {
  return url.pathname.startsWith(endpointRoot.pathname);
}

function jsonResponse(value) {
  return new Response(JSON.stringify(value), {
    headers: commonHeaders("application/json; charset=utf-8"),
  });
}

function pngResponse(base64) {
  return new Response(base64ToBytes(base64), {
    headers: commonHeaders("image/png"),
  });
}

function textResponse(status, message) {
  return new Response(message, {
    status,
    headers: commonHeaders("text/plain; charset=utf-8"),
  });
}

function emptyResponse(status) {
  return new Response(null, {
    status,
    headers: commonHeaders(),
  });
}

function commonHeaders(contentType) {
  const headers = new Headers({
    "Cache-Control": "no-store",
  });

  if (contentType) {
    headers.set("Content-Type", contentType);
  }

  return headers;
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

const workerScope = typeof self === "undefined" ? undefined : self;

if (
  typeof ServiceWorkerGlobalScope !== "undefined" &&
  workerScope instanceof ServiceWorkerGlobalScope
) {
  const handler = createSpriteAssetWorkerHandler({
    cacheStorage: workerScope.caches,
    scope: workerScope.registration.scope,
  });

  workerScope.addEventListener("install", (event) => {
    event.waitUntil(workerScope.skipWaiting());
  });
  workerScope.addEventListener("activate", (event) => {
    event.waitUntil(workerScope.clients.claim());
  });
  workerScope.addEventListener("fetch", (event) => {
    if (
      !isSpriteAssetRequest(
        new URL(event.request.url),
        new URL(assetPrefix, workerScope.registration.scope),
      )
    ) {
      return;
    }
    event.respondWith(handler(event.request));
  });
}
