import type { SpriteJson } from "../../../src";

const serviceWorkerError =
  "MapLibre sprite testing requires an active Service Worker in production.";

let defaultPreparation: Promise<void> | undefined;

export interface SpriteAssetPayload {
  spriteJson: SpriteJson;
  retinaJson: SpriteJson;
  spritePngBase64: string;
  retinaPngBase64: string;
}

interface SpriteAssetHostOptions {
  basePath?: string;
  production?: boolean;
  serviceWorker?: ServiceWorkerContainer | null;
}

export function createSpriteAssetEndpoint(assetId: string, basePath = import.meta.env.BASE_URL) {
  return new URL(
    `__map-sprite-test/${encodeURIComponent(assetId)}`,
    new URL(normalizeBasePath(basePath), window.location.origin),
  ).toString();
}

export function createSpriteBaseUrl(assetId: string, basePath = import.meta.env.BASE_URL) {
  return `${createSpriteAssetEndpoint(assetId, basePath)}/sprite`;
}

export async function publishSpriteAssets(
  assetId: string,
  payload: SpriteAssetPayload,
  basePath = import.meta.env.BASE_URL,
) {
  const response = await fetch(createSpriteAssetEndpoint(assetId, basePath), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("Unable to publish generated sprite assets over HTTP.");
  }
}

export function deleteSpriteAssets(assetId: string, basePath = import.meta.env.BASE_URL) {
  return fetch(createSpriteAssetEndpoint(assetId, basePath), { method: "DELETE" });
}

export function prepareSpriteAssetHost(options: SpriteAssetHostOptions = {}): Promise<void> {
  const production = options.production ?? import.meta.env.PROD;

  if (!production) {
    return Promise.resolve();
  }

  const basePath = normalizeBasePath(options.basePath ?? import.meta.env.BASE_URL);
  if (options.serviceWorker !== undefined) {
    return prepareServiceWorker(options.serviceWorker, basePath);
  }
  if (!("serviceWorker" in navigator)) {
    return Promise.reject(new Error(serviceWorkerError));
  }

  defaultPreparation ??= prepareServiceWorker(navigator.serviceWorker, basePath);

  return defaultPreparation.catch((caught) => {
    defaultPreparation = undefined;
    throw caught;
  });
}

async function prepareServiceWorker(
  serviceWorker: ServiceWorkerContainer | null,
  basePath: string,
) {
  if (!serviceWorker) {
    throw new Error(serviceWorkerError);
  }

  await serviceWorker.register(`${basePath}map-sprite-sw.js`, {
    scope: basePath,
    type: "module",
  });
  await serviceWorker.ready;
  await waitForController(serviceWorker);
}

function waitForController(serviceWorker: ServiceWorkerContainer) {
  if (serviceWorker.controller) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(fail, 5_000);

    function controlled() {
      if (!serviceWorker.controller) {
        return;
      }

      window.clearTimeout(timeout);
      serviceWorker.removeEventListener("controllerchange", controlled);
      resolve();
    }

    function fail() {
      serviceWorker.removeEventListener("controllerchange", controlled);
      reject(new Error(serviceWorkerError));
    }

    serviceWorker.addEventListener("controllerchange", controlled, { once: true });
  });
}

function normalizeBasePath(basePath: string) {
  return basePath.endsWith("/") ? basePath : `${basePath}/`;
}
