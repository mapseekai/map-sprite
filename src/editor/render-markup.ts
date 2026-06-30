import type { PackedIcon, SpriteResult, SvgIconInput } from "../core";
import { svgToDataUrl } from "../core/svg-data-url";
import type { MapSpriteEditorLayout } from "./types";

export interface RenderEditorMarkupState {
  icons: SvgIconInput[];
  sprite: SpriteResult | undefined;
  selectedIcon: PackedIcon | undefined;
  selectedIconId: string | undefined;
  hoveredIcon: PackedIcon | undefined;
  layoutMode: MapSpriteEditorLayout;
  iconPadding: number;
  preserveOrder: boolean;
  zoom: number;
  themeColor: string;
  error: string | undefined;
  spriteError: string | undefined;
  isCustomLayout: boolean;
}

export function renderEditorMarkup(state: RenderEditorMarkupState) {
  const activeError = state.error ?? state.spriteError;
  const json = JSON.stringify(state.sprite?.json ?? {}, null, 2);

  return `
      <main class="map-sprite-editor" style="${renderThemeStyle(state.themeColor)}">
        <header class="mse-toolbar">
          <div>
            <h1>Map Sprite</h1>
            <p>Generate MapLibre / Mapbox sprite.png, sprite.json, and @2x assets from SVG files.</p>
          </div>
          <div class="mse-toolbar-actions">
            <input class="mse-file-input" type="file" accept=".svg,image/svg+xml" multiple />
            <button class="mse-upload" type="button">Upload SVG</button>
            <button class="mse-clear" type="button" ${state.icons.length === 0 ? "disabled" : ""}>Clear</button>
            <button class="mse-export" type="button" ${!state.sprite || state.icons.length === 0 ? "disabled" : ""}>Export ZIP</button>
          </div>
        </header>
        ${activeError ? `<div class="mse-message">${escapeHtml(activeError)}</div>` : ""}
        <section class="mse-workspace">
          <aside class="mse-list" aria-label="Imported icons">
            <div class="mse-heading">
              <h2>Icons</h2>
              <span>${state.icons.length}</span>
            </div>
            <div class="mse-items">
              ${(state.sprite?.icons ?? [])
                .map((icon) => renderIconRow(icon, state.selectedIconId, state.isCustomLayout))
                .join("")}
            </div>
          </aside>
          <section class="mse-canvas-panel">
            <div class="mse-canvas-tools">
              <span>Sprite ${
                state.sprite && state.sprite.width > 0
                  ? `${state.sprite.width} x ${state.sprite.height}`
                  : "0 x 0"
              }</span>
              <div class="mse-tool-group">
                <label>Layout
                  <select class="mse-logic">
                    <option value="max-edge" ${state.layoutMode === "max-edge" ? "selected" : ""}>Max edge</option>
                    <option value="max-area" ${state.layoutMode === "max-area" ? "selected" : ""}>Max area</option>
                    <option value="custom" ${state.layoutMode === "custom" ? "selected" : ""}>Custom</option>
                  </select>
                </label>
                <label>Gap
                  <input class="mse-gap" min="0" max="64" step="1" type="number" value="${state.iconPadding}" />
                </label>
                <label class="mse-order-label">Keep order
                  <input class="mse-preserve-order" type="checkbox" ${state.preserveOrder ? "checked" : ""} ${state.isCustomLayout ? "disabled" : ""} />
                </label>
                <label>Zoom
                  <select class="mse-zoom">
                    ${[1, 2, 4, 8]
                      .map(
                        (value) =>
                          `<option value="${value}" ${state.zoom === value ? "selected" : ""}>${value}x</option>`,
                      )
                      .join("")}
                  </select>
                </label>
                <label>Theme
                  <input class="mse-theme" type="color" value="${state.themeColor}" />
                </label>
              </div>
            </div>
            <div class="mse-stage">
              <canvas class="mse-canvas"></canvas>
            </div>
          </section>
          <aside class="mse-output">
            <div class="mse-heading">
              <h2>Output</h2>
              <span>${state.sprite ? `${state.sprite.width} x ${state.sprite.height}` : "0 x 0"}</span>
            </div>
            <section class="mse-details">
              <h3>Selected</h3>
              ${
                state.selectedIcon
                  ? renderSelectedDetails(state.selectedIcon)
                  : "<p>No icon selected.</p>"
              }
              ${
                state.hoveredIcon
                  ? `<p class="mse-hover-note">Hovering ${escapeHtml(state.hoveredIcon.name)}</p>`
                  : ""
              }
            </section>
            <pre>${escapeHtml(json)}</pre>
          </aside>
        </section>
      </main>
    `;
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderThemeStyle(themeColor: string) {
  return `--mse-accent: ${themeColor}; --mse-accent-soft: ${hexToRgba(
    themeColor,
    0.12,
  )}; --mse-accent-strong-soft: ${hexToRgba(themeColor, 0.22)};`;
}

function renderIconRow(icon: PackedIcon, selectedIconId: string | undefined, canDrag: boolean) {
  return `
      <button class="mse-row ${icon.id === selectedIconId ? "is-selected" : ""}" data-icon-id="${escapeHtml(icon.id)}" draggable="${canDrag}" type="button">
        <span class="mse-thumb"><img alt="" src="${escapeHtml(svgToDataUrl(icon.svgText))}" /></span>
        <span>
          <strong>${escapeHtml(icon.name)}</strong>
          <small>${icon.width} x ${icon.height}</small>
        </span>
        <span class="mse-row-delete" role="button" tabindex="0">Delete</span>
      </button>
    `;
}

function renderSelectedDetails(icon: PackedIcon) {
  return `
      <dl>
        <dt>Name</dt><dd>${escapeHtml(icon.name)}</dd>
        <dt>File</dt><dd>${escapeHtml(icon.fileName)}</dd>
        <dt>Size</dt><dd>${icon.width} x ${icon.height}</dd>
        <dt>Source</dt><dd>${icon.sourceWidth} x ${icon.sourceHeight}</dd>
        <dt>Rotation</dt><dd>${icon.rotation} deg</dd>
        <dt>Position</dt><dd>${icon.x}, ${icon.y}</dd>
      </dl>
      <div class="mse-rotation-actions">
        <button class="mse-rotate-left" type="button">Rotate left</button>
        <button class="mse-rotate-right" type="button">Rotate right</button>
      </div>
    `;
}

function hexToRgba(color: string, alpha: number) {
  const red = Number.parseInt(color.slice(1, 3), 16);
  const green = Number.parseInt(color.slice(3, 5), 16);
  const blue = Number.parseInt(color.slice(5, 7), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}
