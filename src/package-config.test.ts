import { describe, expect, it } from "vitest";
import packageJson from "../package.json";
import tsconfigBuild from "../tsconfig.build.json";

describe("package build configuration", () => {
  it("emits the declaration file advertised by package exports", async () => {
    expect(packageJson.types).toBe("./dist/index.d.ts");
    expect(packageJson.exports["."].types).toBe("./dist/index.d.ts");
    expect(packageJson.files).toContain("CHANGELOG.md");
    expect(packageJson.scripts.build).toContain("vite build --config vite.lib.config.ts");
    expect(packageJson.scripts.build).toContain("tsc -p tsconfig.build.json");
    expect(tsconfigBuild.compilerOptions.declaration).toBe(true);
    expect(tsconfigBuild.compilerOptions.emitDeclarationOnly).toBe(true);
    expect(tsconfigBuild.compilerOptions.outDir).toBe("dist");
  });
});
