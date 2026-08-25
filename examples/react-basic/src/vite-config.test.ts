// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => vi.unstubAllEnvs());

describe("Vite example configuration", () => {
  it("uses VITE_BASE_PATH for a repository-hosted build", async () => {
    vi.stubEnv("VITE_BASE_PATH", "/map-sprite/");
    vi.resetModules();

    const configFactory = (await import("../../../vite.config")).default;
    const config = await configFactory({
      command: "build",
      mode: "test",
      isPreview: false,
      isSsrBuild: false,
    });

    expect(config.base).toBe("/map-sprite/");
  });
});
