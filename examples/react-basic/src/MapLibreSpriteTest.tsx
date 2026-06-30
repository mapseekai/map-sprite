import { useEffect, useRef, useState } from "react";
import {
  createRetinaSpriteJson,
  renderSpritePng,
  type SpriteJson,
  type SpriteResult,
} from "../../../src";

type TestStatus = "empty" | "loading" | "ready" | "error";

interface TestState {
  status: TestStatus;
  message: string;
  iconNames: string[];
  spriteBaseUrl?: string;
  spriteJson?: SpriteJson;
  retinaJson?: SpriteJson;
}

interface MapLibreGlobal {
  Map: new (options: Record<string, unknown>) => MapLibreMap;
}

interface MapLibreMap {
  on(eventName: "load", listener: () => void): void;
  on(eventName: "error", listener: (event: { error?: Error }) => void): void;
  resize(): void;
  remove(): void;
}

declare global {
  interface Window {
    maplibregl?: MapLibreGlobal;
  }
}

const mapLibreCssUrl = "https://unpkg.com/maplibre-gl/dist/maplibre-gl.css";
const mapLibreScriptUrl = "https://unpkg.com/maplibre-gl/dist/maplibre-gl.js";
let mapLibrePromise: Promise<MapLibreGlobal> | undefined;

export function MapLibreSpriteTest({ sprite }: { sprite: SpriteResult | undefined }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<TestState>({
    status: "empty",
    message: "Upload SVG icons in Sprite Editor first, then open this MapLibre test view.",
    iconNames: [],
  });

  useEffect(() => {
    let cancelled = false;
    let map: MapLibreMap | undefined;
    let assetId: string | undefined;

    if (!sprite || sprite.icons.length === 0) {
      setState({
        status: "empty",
        message: "Upload SVG icons in Sprite Editor first, then open this MapLibre test view.",
        iconNames: [],
      });
      return () => {
        cancelled = true;
      };
    }
    const currentSprite = sprite;

    async function runTest() {
      try {
        setState({
          status: "loading",
          message: "Loading MapLibre GL JS and rendering the Sprite Editor output...",
          iconNames: currentSprite.icons.map((icon) => icon.name),
          spriteJson: currentSprite.json,
          retinaJson: createRetinaSpriteJson(currentSprite),
        });

        const [maplibregl, spriteBundle] = await Promise.all([
          loadMapLibreGl(),
          createSpriteBundle(currentSprite),
        ]);
        assetId = spriteBundle.assetId;

        if (cancelled || !mapRef.current) {
          return;
        }

        map = new maplibregl.Map({
          container: mapRef.current,
          style: {
            version: 8,
            sprite: spriteBundle.spriteBaseUrl,
            sources: {
              osm: {
                type: "raster",
                tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
                tileSize: 256,
                attribution: "OpenStreetMap",
              },
              "generated-icons": {
                type: "geojson",
                data: {
                  type: "FeatureCollection",
                  features: spriteBundle.iconNames.map((iconName, index) => ({
                    type: "Feature",
                    geometry: {
                      type: "Point",
                      coordinates: [116.377 + index * 0.02, 39.9 + (index % 2) * 0.018],
                    },
                    properties: {
                      icon: iconName,
                    },
                  })),
                },
              },
            },
            layers: [
              {
                id: "osm",
                type: "raster",
                source: "osm",
              },
              {
                id: "generated-icons",
                type: "symbol",
                source: "generated-icons",
                layout: {
                  "icon-image": ["get", "icon"],
                  "icon-size": 1,
                  "icon-allow-overlap": true,
                },
              },
            ],
          },
          center: [116.397, 39.908],
          zoom: 11,
        });

        map.on("load", () => {
          if (!map) {
            return;
          }

          map.resize();

          setState({
            status: "ready",
            message: "MapLibre loaded the current Sprite Editor output through style.sprite.",
            iconNames: spriteBundle.iconNames,
            spriteBaseUrl: spriteBundle.spriteBaseUrl,
            spriteJson: spriteBundle.spriteJson,
            retinaJson: spriteBundle.retinaJson,
          });
        });

        map.on("error", (event) => {
          setState((current) => ({
            ...current,
            status: current.status === "ready" ? current.status : "error",
            message: event.error?.message ?? "MapLibre emitted an error.",
          }));
        });
      } catch (caught) {
        if (!cancelled) {
          setState({
            status: "error",
            message: caught instanceof Error ? caught.message : "Unable to run MapLibre test.",
            iconNames: [],
          });
        }
      }
    }

    void runTest();

    return () => {
      cancelled = true;
      map?.remove();
      if (assetId) {
        void fetch(`/__map-sprite-test/${assetId}`, { method: "DELETE" });
      }
    };
  }, [sprite]);

  return (
    <section className="maplibre-test">
      <div className="maplibre-map" ref={mapRef} />
      <aside className="maplibre-panel">
        <div className={`status-pill status-${state.status}`}>{state.status}</div>
        <h2>Generated Sprite In MapLibre</h2>
        <p>{state.message}</p>

        <div className="asset-preview">
          <div>
            <span>sprite.png</span>
            {state.spriteBaseUrl ? (
              <img alt="Generated 1x sprite sheet" src={`${state.spriteBaseUrl}.png`} />
            ) : null}
          </div>
          <div>
            <span>sprite@2x.png</span>
            {state.spriteBaseUrl ? (
              <img alt="Generated 2x sprite sheet" src={`${state.spriteBaseUrl}@2x.png`} />
            ) : null}
          </div>
        </div>

        <dl className="compat-list">
          <dt>CDN</dt>
          <dd>maplibre-gl</dd>
          <dt>Icons</dt>
          <dd>{state.iconNames.length > 0 ? state.iconNames.join(", ") : "pending"}</dd>
          <dt>Map API</dt>
          <dd>style.sprite + symbol layer</dd>
          <dt>Sprite URL</dt>
          <dd>{state.spriteBaseUrl ?? "pending"}</dd>
          <dt>Source</dt>
          <dd>Sprite Editor onChange</dd>
        </dl>

        <pre>{JSON.stringify(state.spriteJson ?? {}, null, 2)}</pre>
      </aside>
    </section>
  );
}

async function createSpriteBundle(sprite: SpriteResult) {
  const assetId = createAssetId();
  const spriteBaseUrl = `${window.location.origin}/__map-sprite-test/${assetId}/sprite`;
  const [spritePng, retinaPng] = await Promise.all([
    renderSpritePng(sprite),
    renderSpritePng(sprite, { pixelRatio: 2 }),
  ]);
  const spriteJson = sprite.json;
  const retinaJson = createRetinaSpriteJson(sprite);

  const response = await fetch(`/__map-sprite-test/${assetId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      spriteJson,
      retinaJson,
      spritePngBase64: await blobToBase64(spritePng),
      retinaPngBase64: await blobToBase64(retinaPng),
    }),
  });

  if (!response.ok) {
    throw new Error("Unable to publish generated sprite assets over HTTP.");
  }

  return {
    assetId,
    iconNames: sprite.icons.map((icon) => icon.name),
    spriteBaseUrl,
    spriteJson,
    retinaJson,
  };
}

function createAssetId() {
  return window.crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const [, base64 = ""] = result.split(",");
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("Unable to encode generated sprite PNG."));
    reader.readAsDataURL(blob);
  });
}

function loadMapLibreGl() {
  if (window.maplibregl) {
    return Promise.resolve(window.maplibregl);
  }
  if (mapLibrePromise) {
    return mapLibrePromise;
  }

  mapLibrePromise = new Promise<MapLibreGlobal>((resolve, reject) => {
    ensureStylesheet(mapLibreCssUrl);

    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${mapLibreScriptUrl}"]`,
    );
    if (existingScript) {
      existingScript.addEventListener("load", () => resolveLoadedMapLibre(resolve, reject), {
        once: true,
      });
      existingScript.addEventListener(
        "error",
        () => reject(new Error("Unable to load MapLibre GL JS.")),
        {
          once: true,
        },
      );
      return;
    }

    const script = document.createElement("script");
    script.src = mapLibreScriptUrl;
    script.async = true;
    script.onload = () => resolveLoadedMapLibre(resolve, reject);
    script.onerror = () => reject(new Error("Unable to load MapLibre GL JS."));
    document.head.append(script);
  });

  return mapLibrePromise;
}

function resolveLoadedMapLibre(
  resolve: (maplibregl: MapLibreGlobal) => void,
  reject: (error: Error) => void,
) {
  if (window.maplibregl) {
    resolve(window.maplibregl);
    return;
  }
  reject(new Error("MapLibre GL JS did not attach to window.maplibregl."));
}

function ensureStylesheet(href: string) {
  if (document.querySelector(`link[href="${href}"]`)) {
    return;
  }

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.append(link);
}
