# GitHub Pages MapLibre Demo Design

**Date:** 2026-08-26  
**Status:** Approved

## Goal

Publish the React example at `https://mapseekai.github.io/map-sprite/` through GitHub Pages, while preserving the end-to-end MapLibre check: an uploaded SVG must generate sprite assets that MapLibre loads through the style `sprite` URL.

## Constraints

- GitHub Pages provides static files only; it cannot host the Vite development middleware that currently receives and serves generated sprite assets.
- The deployed site must work from its repository subpath, not only from `/`.
- Local development through `npm run dev` must keep working without requiring a production deployment.
- The solution must not add a server, external storage service, or runtime credentials.

## Architecture

The React example remains a Vite application. Production builds add a browser-side asset host implemented as a Service Worker plus Cache Storage.

`MapLibreSpriteTest` renders the current editor sprite at 1x and 2x, serializes the generated JSON and PNG payloads, and publishes them to a same-origin endpoint. In a local development server, the existing Vite middleware continues to implement that endpoint. In a GitHub Pages build, the Service Worker implements the same endpoint entirely in the browser.

The Service Worker is emitted as a Vite public asset and registered using `import.meta.env.BASE_URL`. This keeps its scope inside `/map-sprite/` on GitHub Pages and at `/` for a local build. Its route handling is limited to `__map-sprite-test/` so normal site requests are untouched.

## Data Flow

1. The editor updates its `SpriteResult` after SVG import or edits.
2. `MapLibreSpriteTest` calls a dedicated sprite-asset helper to wait for Service Worker control in production, construct a base-aware asset URL, and POST the 1x/2x JSON and PNG payload.
3. The Service Worker writes four synthetic responses to Cache Storage:
   - `sprite.json`
   - `sprite.png`
   - `sprite@2x.json`
   - `sprite@2x.png`
4. MapLibre receives the generated base URL through `style.sprite` and issues its ordinary HTTP asset requests. The Service Worker returns the cached responses.
5. Component cleanup sends DELETE for the generated asset ID, and the Service Worker removes the four cache entries.

The service worker accepts `OPTIONS`, `POST`, `GET`, and `DELETE` only for the generated-sprite route. A cache miss returns a clear `404`; invalid POST payloads return `400`; other paths fall through to the browser network stack.

## Error Handling

- The browser must have an active Service Worker controller before production assets are published. The helper waits for activation and rejects with a clear message if registration or control fails.
- Cache writes, rendering failures, and non-success response codes flow into the existing MapLibre test error panel.
- GitHub Pages uses HTTPS, so Service Worker requirements are satisfied for the live site. A browser that disables Service Workers will show the explicit compatibility error rather than a misleading MapLibre failure.
- Development mode keeps the Vite middleware fallback, avoiding a Service Worker dependency for `npm run dev`.

## Build and Deployment

`vite.config.ts` will read a build-time `VITE_BASE_PATH` value, defaulting to `/`. A new `build:example` script builds `examples/react-basic` with that configuration and produces a static Pages artifact. The deployment workflow passes `/${{ github.event.repository.name }}/`, enabling both this repository and forks to use their correct GitHub Pages subpath.

A new workflow will run on pushes to `main` and via `workflow_dispatch`. It will:

1. Check out the repository and install the locked Node dependencies.
2. Run formatting, tests, and TypeScript checks.
3. Build the example with its repository-aware base path.
4. Configure GitHub Pages, upload the example artifact, and deploy it.

The workflow grants only the permissions required for Pages deployment: `contents: read`, `pages: write`, and `id-token: write`, and uses a Pages concurrency group. The repository Pages build type will be enabled as `workflow` once through GitHub's API using the authenticated administrator account.

## Files

| Path | Change |
| --- | --- |
| `package.json` | Add example build and preview scripts. |
| `vite.config.ts` | Support the configurable Vite base path while retaining the development test middleware. |
| `examples/react-basic/src/sprite-asset-host.ts` | Own base-aware endpoints, production Service Worker registration/readiness, publish, and deletion. |
| `examples/react-basic/src/sprite-asset-host.test.ts` | Verify base-aware URLs and the publish/cleanup request contract. |
| `examples/react-basic/src/MapLibreSpriteTest.tsx` | Use the asset host rather than hard-coded root URLs and direct fetch lifecycle code. |
| `examples/react-basic/public/map-sprite-sw.js` | Serve dynamic generated sprite assets from Cache Storage on static hosting. |
| `.github/workflows/deploy-example.yml` | Build and deploy the public GitHub Pages example. |
| `README.md` | Link to the live example and document the example build commands. |

## Verification

- Test the new helper's public behavior first: Pages-path URL generation, successful publish, failed publish, and cleanup.
- Run the complete unit suite, formatting check, type check, package build, and example build.
- Serve the production artifact locally with Vite preview and verify that the MapLibre test displays generated icons through the Service Worker-backed sprite URLs.
- After the workflow is pushed, inspect its deployment result and load the reported public URL.

## Acceptance Criteria

- `https://mapseekai.github.io/map-sprite/` serves the React example after the GitHub Actions deployment succeeds.
- Site assets and the Service Worker resolve below `/map-sprite/` rather than the host root.
- An SVG uploaded in the public editor appears in the MapLibre test view through `style.sprite` without a backend server.
- Leaving the test view removes the generated temporary sprite assets.
- Existing local development and all existing quality gates remain functional.
