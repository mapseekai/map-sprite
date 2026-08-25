/// <reference types="vitest" />

import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "VITE_");

  return {
    base: env.VITE_BASE_PATH ?? "/",
    plugins: [mapSpriteHttpTestPlugin(), react()],
    test: {
      environment: "jsdom",
    },
  };
});

interface DevSpritePayload {
  spriteJson: unknown;
  retinaJson: unknown;
  spritePngBase64: string;
  retinaPngBase64: string;
}

interface DevRequest extends AsyncIterable<string | Uint8Array> {
  method?: string;
  url?: string;
}

interface DevResponse {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(chunk?: string | Uint8Array): void;
}

function mapSpriteHttpTestPlugin(): Plugin {
  const spriteAssets = new Map<string, DevSpritePayload>();

  return {
    name: "map-sprite-http-test",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const devRequest = request as DevRequest;
        const devResponse = response as DevResponse;
        const path = devRequest.url?.split("?")[0] ?? "";

        if (!path.startsWith("/__map-sprite-test/")) {
          next();
          return;
        }

        try {
          if (devRequest.method === "OPTIONS") {
            sendEmpty(devResponse, 204);
            return;
          }

          const assetMutationMatch = path.match(/^\/__map-sprite-test\/([^/]+)$/);
          if (assetMutationMatch && devRequest.method === "POST") {
            const payload = await readSpritePayload(devRequest);
            spriteAssets.set(assetMutationMatch[1], payload);
            sendEmpty(devResponse, 204);
            return;
          }

          if (assetMutationMatch && devRequest.method === "DELETE") {
            spriteAssets.delete(assetMutationMatch[1]);
            sendEmpty(devResponse, 204);
            return;
          }

          const assetMatch = path.match(/^\/__map-sprite-test\/([^/]+)\/sprite(@2x)?\.(json|png)$/);
          if (!assetMatch || devRequest.method !== "GET") {
            sendText(devResponse, 404, "Not found");
            return;
          }

          const [, assetId, retinaSuffix, extension] = assetMatch;
          const payload = spriteAssets.get(assetId);
          if (!payload) {
            sendText(devResponse, 404, "Generated sprite asset was not found");
            return;
          }

          if (extension === "json") {
            sendJson(devResponse, retinaSuffix ? payload.retinaJson : payload.spriteJson);
            return;
          }

          sendPng(devResponse, retinaSuffix ? payload.retinaPngBase64 : payload.spritePngBase64);
        } catch (caught) {
          sendText(
            devResponse,
            500,
            caught instanceof Error ? caught.message : "Sprite server error",
          );
        }
      });
    },
  };
}

async function readSpritePayload(request: DevRequest): Promise<DevSpritePayload> {
  const body = await readBody(request);
  const payload = JSON.parse(body) as Partial<DevSpritePayload>;

  if (
    typeof payload.spritePngBase64 !== "string" ||
    typeof payload.retinaPngBase64 !== "string" ||
    !payload.spriteJson ||
    !payload.retinaJson
  ) {
    throw new Error("Invalid generated sprite payload");
  }

  return {
    spriteJson: payload.spriteJson,
    retinaJson: payload.retinaJson,
    spritePngBase64: payload.spritePngBase64,
    retinaPngBase64: payload.retinaPngBase64,
  };
}

async function readBody(request: DevRequest) {
  let body = "";

  for await (const chunk of request) {
    body += typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk);
  }

  return body;
}

function sendJson(response: DevResponse, value: unknown) {
  setCommonHeaders(response);
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(value));
}

function sendPng(response: DevResponse, base64: string) {
  setCommonHeaders(response);
  response.setHeader("Content-Type", "image/png");
  response.end(base64ToBytes(base64));
}

function sendText(response: DevResponse, statusCode: number, message: string) {
  setCommonHeaders(response);
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "text/plain; charset=utf-8");
  response.end(message);
}

function sendEmpty(response: DevResponse, statusCode: number) {
  setCommonHeaders(response);
  response.statusCode = statusCode;
  response.end();
}

function setCommonHeaders(response: DevResponse) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Cache-Control", "no-store");
}

function base64ToBytes(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}
