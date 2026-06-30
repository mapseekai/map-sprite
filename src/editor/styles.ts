export const editorStyles = `
.map-sprite-editor {
  --mse-accent: #3fb572;
  --mse-accent-soft: rgba(63, 181, 114, 0.12);
  --mse-accent-strong-soft: rgba(63, 181, 114, 0.22);
  min-height: 100%;
  display: flex;
  flex-direction: column;
  color: #172033;
  background: #edf1f5;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
.map-sprite-editor * {
  box-sizing: border-box;
}
.map-sprite-editor button,
.map-sprite-editor input,
.map-sprite-editor select {
  font: inherit;
}
.mse-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 18px 22px;
  background: #ffffff;
  border-bottom: 1px solid #d7dee8;
}
.mse-toolbar h1,
.mse-toolbar p,
.mse-heading h2,
.mse-details h3 {
  margin: 0;
}
.mse-toolbar h1 {
  font-size: 22px;
  line-height: 1.2;
}
.mse-toolbar p {
  margin-top: 4px;
  color: #5c667a;
  font-size: 14px;
}
.mse-toolbar-actions,
.mse-canvas-tools,
.mse-tool-group,
.mse-rotation-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.mse-toolbar-actions {
  flex-wrap: wrap;
  justify-content: flex-end;
}
.mse-toolbar-actions input[type="file"] {
  display: none;
}
.mse-toolbar-actions button,
.mse-row-delete,
.mse-rotation-actions button {
  min-height: 34px;
  border: 1px solid #b9c3d2;
  border-radius: 6px;
  background: #ffffff;
  color: #172033;
  padding: 0 12px;
  cursor: pointer;
}
.mse-toolbar-actions button:last-child {
  background: var(--mse-accent);
  border-color: var(--mse-accent);
  color: #ffffff;
}
.mse-toolbar-actions button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.mse-message {
  margin: 14px 22px 0;
  padding: 10px 12px;
  border: 1px solid #f2b8a2;
  background: #fff4ef;
  color: #9a3412;
  border-radius: 6px;
}
.mse-workspace {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(220px, 280px) minmax(360px, 1fr) minmax(280px, 380px);
  gap: 14px;
  padding: 14px 22px 22px;
}
.mse-list,
.mse-output,
.mse-canvas-panel {
  min-width: 0;
  background: #ffffff;
  border: 1px solid #d7dee8;
  border-radius: 8px;
}
.mse-list,
.mse-output {
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.mse-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid #e2e8f0;
}
.mse-heading h2 {
  font-size: 15px;
}
.mse-heading span {
  color: #5c667a;
  font-size: 13px;
}
.mse-items {
  overflow: auto;
  padding: 8px;
}
.mse-row {
  width: 100%;
  min-height: 58px;
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  padding: 8px;
  text-align: left;
  cursor: grab;
}
.mse-row.is-selected {
  border-color: var(--mse-accent);
  background: var(--mse-accent-soft);
}
.mse-row.is-drop-target {
  border-style: dashed;
  border-color: var(--mse-accent);
  background: var(--mse-accent-strong-soft);
}
.mse-thumb {
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
}
.mse-thumb img {
  max-width: 32px;
  max-height: 32px;
}
.mse-row strong,
.mse-row small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mse-row small {
  color: #5c667a;
  margin-top: 2px;
}
.mse-row-delete {
  display: inline-grid;
  place-items: center;
  min-height: 28px;
  font-size: 12px;
}
.mse-canvas-panel {
  min-height: 420px;
  overflow: auto;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.mse-canvas-tools {
  justify-content: space-between;
  color: #5c667a;
  font-size: 13px;
}
.mse-tool-group {
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
}
.mse-tool-group label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.mse-tool-group input,
.mse-tool-group select {
  height: 30px;
  border: 1px solid #b9c3d2;
  border-radius: 6px;
  background: #ffffff;
  color: #172033;
}
.mse-tool-group input {
  width: 64px;
  padding: 0 8px;
}
.mse-tool-group .mse-order-label {
  gap: 6px;
}
.mse-tool-group input[type="checkbox"] {
  width: 16px;
  height: 16px;
  padding: 0;
  cursor: pointer;
}
.mse-tool-group input[type="checkbox"]:disabled {
  cursor: not-allowed;
}
.mse-tool-group input[type="color"] {
  width: 38px;
  padding: 2px;
  cursor: pointer;
}
.mse-stage {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 18px;
  border: 1px solid #c7d0dc;
  border-radius: 6px;
  background-color: #ffffff;
  background-image:
    linear-gradient(45deg, #cbd5e1 25%, transparent 25%),
    linear-gradient(-45deg, #cbd5e1 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #cbd5e1 75%),
    linear-gradient(-45deg, transparent 75%, #cbd5e1 75%);
  background-position: 0 0, 0 8px, 8px -8px, -8px 0;
  background-size: 16px 16px;
}
.mse-stage canvas {
  display: block;
  border: 1px dashed #aeb8c6;
  background: transparent;
  cursor: grab;
}
.mse-details {
  padding: 14px;
  border-bottom: 1px solid #e2e8f0;
}
.mse-details h3 {
  font-size: 14px;
  margin-bottom: 10px;
}
.mse-details dl {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  gap: 6px 10px;
  margin: 0;
  font-size: 13px;
}
.mse-details dt {
  color: #5c667a;
}
.mse-details dd {
  margin: 0;
  overflow-wrap: anywhere;
}
.mse-details p,
.mse-hover-note {
  margin: 0;
  color: #5c667a;
  font-size: 13px;
}
.mse-rotation-actions {
  margin-top: 12px;
}
.mse-output pre {
  flex: 1;
  margin: 0;
  overflow: auto;
  padding: 14px;
  color: #172033;
  background: #fbfdff;
  font-size: 12px;
  line-height: 1.5;
}
@media (max-width: 980px) {
  .mse-toolbar {
    align-items: flex-start;
    flex-direction: column;
  }
  .mse-workspace {
    grid-template-columns: 1fr;
  }
}
`;
