# Changelog

## 0.1.2 - 2026-06-30

### Added

- Added a browser MapLibre compatibility example that uses the current `MapSpriteEditor` output and exposes generated sprite assets over HTTP.
- Added a Vite dev middleware for the example so MapLibre can load `sprite.json`, `sprite.png`, `sprite@2x.json`, and `sprite@2x.png` through `style.sprite`.
- Added regression tests for MapLibre / Mapbox sprite style compatibility, SVG safety checks, editor state ownership, and package build configuration.
- Added generated TypeScript declaration output with `tsconfig.build.json` and a dedicated `vite.lib.config.ts` library build config.

### Changed

- `MapSpriteEditor` now copies icon arrays at constructor, `setIcons`, `getState`, and `onChange` boundaries so callers cannot mutate editor state by retaining array references.
- Split editor HTML rendering and canvas drawing helpers into focused modules.
- Unified SVG image data URL encoding across PNG rendering and editor previews.
- Switched repository package metadata to npm through `packageManager` and removed the stale pnpm lockfile.

### Fixed

- Rejected unsafe SVG content at the `parseSvgText` import boundary, including scripts, event attributes, `foreignObject`, and dangerous external references.
- Prevented packed sprites from exceeding configured final bounds after border padding is applied.
- Ensured published package contents include the declaration file advertised by package exports.

## 0.1.1 - 2026-06-01

### Added

- Initial public package release with framework-independent sprite generation utilities, browser PNG rendering, ZIP export, and a React example.
