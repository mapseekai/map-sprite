import {
  createSprite,
  createSpriteJson,
  exportSpriteZip,
  parseSvgText,
  type PackedIcon,
  type SpritePackingLogic,
  type SpriteResult,
  type SpriteRotation,
  type SvgIconInput,
} from "../core";
import { svgToDataUrl } from "../core/svg-data-url";
import {
  drawCanvasIcon,
  drawDragGhost,
  drawPreviewFrame,
  drawSelectionFrame,
  type CanvasPoint,
} from "./canvas-drawing";
import { renderEditorMarkup } from "./render-markup";
import { editorStyles } from "./styles";
import type { MapSpriteEditorLayout, MapSpriteEditorOptions, MapSpriteEditorState } from "./types";

const styleElementId = "map-sprite-editor-styles";
const defaultThemeColor = "#3fb572";

type PendingCanvasDrag = {
  iconId: string;
  start: CanvasPoint;
};

export class MapSpriteEditor {
  private container: HTMLElement;
  private icons: SvgIconInput[];
  private selectedIconId: string | undefined;
  private hoveredIcon: PackedIcon | undefined;
  private layoutMode: MapSpriteEditorLayout;
  private iconPadding: number;
  private preserveOrder: boolean;
  private zoom: number;
  private themeColor: string;
  private error: string | undefined;
  private customPositions = new Map<string, CanvasPoint>();
  private pendingCanvasDrag: PendingCanvasDrag | undefined;
  private draggedIconId: string | undefined;
  private dragPreviewTargetId: string | undefined;
  private dragPointer: CanvasPoint | undefined;
  private previewImageCache = new Map<string, Promise<HTMLImageElement>>();
  private onChange?: MapSpriteEditorOptions["onChange"];
  private onError?: MapSpriteEditorOptions["onError"];

  constructor(options: MapSpriteEditorOptions) {
    const container = resolveContainer(options.container);
    if (!container) {
      throw new Error("MapSpriteEditor container was not found.");
    }

    this.container = container;
    this.icons = [...(options.icons ?? [])];
    this.layoutMode = options.logic ?? "max-edge";
    this.iconPadding = options.padding ?? 2;
    this.preserveOrder = options.preserveOrder ?? true;
    this.zoom = options.zoom ?? 4;
    this.themeColor = normalizeThemeColor(options.themeColor);
    this.onChange = options.onChange;
    this.onError = options.onError;
    if (this.isCustomLayout()) {
      this.ensureCustomPositions(this.icons);
    }

    injectStyles();
    this.render();
  }

  destroy() {
    this.container.innerHTML = "";
  }

  getState(): MapSpriteEditorState {
    return {
      icons: [...this.icons],
      sprite: this.createCurrentSprite(),
    };
  }

  setIcons(icons: SvgIconInput[]) {
    this.icons = [...icons];
    this.selectedIconId = this.icons.at(-1)?.id;
    if (this.isCustomLayout()) {
      this.reflowCustomPositions(this.icons);
    }
    this.render();
  }

  setThemeColor(color: string) {
    this.themeColor = normalizeThemeColor(color);
    this.render();
  }

  private freezeCustomPositions(sprite: SpriteResult | undefined) {
    if (sprite) {
      this.customPositions = new Map(
        sprite.icons.map((icon) => [icon.id, { x: icon.x, y: icon.y }]),
      );
    }
    this.ensureCustomPositions(this.icons);
  }

  private ensureCustomPositions(icons: SvgIconInput[]) {
    const uniqueIcons = dedupeIconsByName(icons);
    for (const icon of uniqueIcons) {
      if (!this.customPositions.has(icon.id)) {
        this.customPositions.set(icon.id, this.getNextCustomPosition());
      }
    }
    this.pruneCustomPositions(uniqueIcons);
  }

  private pruneCustomPositions(icons: SvgIconInput[]) {
    const iconIds = new Set(icons.map((icon) => icon.id));
    for (const iconId of this.customPositions.keys()) {
      if (!iconIds.has(iconId)) {
        this.customPositions.delete(iconId);
      }
    }
  }

  private getNextCustomPosition(): CanvasPoint {
    const currentSprite =
      this.customPositions.size > 0 ? this.createCustomSpriteFromPositions() : undefined;
    if (!currentSprite || currentSprite.icons.length === 0) {
      return { x: 1, y: 1 };
    }

    return {
      x: 1,
      y: currentSprite.height + this.iconPadding,
    };
  }

  private createCustomSpriteFromPositions(): SpriteResult {
    const packedIcons = dedupeIconsByName(this.icons).map((icon) => {
      const packedIcon = toCustomPackedIcon(icon);
      const position = this.customPositions.get(icon.id) ?? { x: 1, y: 1 };
      return {
        ...packedIcon,
        x: position.x,
        y: position.y,
      };
    });

    return {
      width: getCustomSpriteSize(packedIcons, "width"),
      height: getCustomSpriteSize(packedIcons, "height"),
      icons: packedIcons,
      json: createSpriteJson(packedIcons, 1),
    };
  }

  private createCurrentSprite(): SpriteResult {
    return this.createSpriteFromIcons(this.icons);
  }

  private createSpriteFromIcons(icons: SvgIconInput[]): SpriteResult {
    if (this.isCustomLayout()) {
      this.ensureCustomPositions(icons);
      return this.createCustomSprite(icons);
    }

    return createSprite(icons, {
      logic: this.layoutMode as SpritePackingLogic,
      padding: this.iconPadding,
      preserveOrder: this.preserveOrder,
    });
  }

  private isCustomLayout() {
    return this.layoutMode === "custom";
  }

  private createCustomSprite(icons: SvgIconInput[]): SpriteResult {
    const uniqueIcons = dedupeIconsByName(icons);
    const packedIcons = uniqueIcons.map((icon) => {
      const packedIcon = toCustomPackedIcon(icon);
      const position = this.customPositions.get(icon.id) ?? this.getNextCustomPosition();
      this.customPositions.set(icon.id, position);

      return {
        ...packedIcon,
        x: position.x,
        y: position.y,
      };
    });

    this.pruneCustomPositions(uniqueIcons);

    return {
      width: getCustomSpriteSize(packedIcons, "width"),
      height: getCustomSpriteSize(packedIcons, "height"),
      icons: packedIcons,
      json: createSpriteJson(packedIcons, 1),
    };
  }

  private render() {
    const spriteState = this.resolveSpriteState();
    const sprite = spriteState.sprite;
    const selectedIcon = sprite?.icons.find((icon) => icon.id === this.selectedIconId);

    this.container.innerHTML = renderEditorMarkup({
      icons: this.icons,
      sprite,
      selectedIcon,
      selectedIconId: this.selectedIconId,
      hoveredIcon: this.hoveredIcon,
      layoutMode: this.layoutMode,
      iconPadding: this.iconPadding,
      preserveOrder: this.preserveOrder,
      zoom: this.zoom,
      themeColor: this.themeColor,
      error: this.error,
      spriteError: spriteState.error,
      isCustomLayout: this.isCustomLayout(),
    });
    this.bindEvents(sprite);
    void this.drawCanvas(sprite);

    if (sprite) {
      this.onChange?.({ icons: [...this.icons], sprite });
    }
  }

  private resolveSpriteState(): { sprite?: SpriteResult; error?: string } {
    try {
      return { sprite: this.createCurrentSprite() };
    } catch (caught) {
      const error = caught instanceof Error ? caught : new Error("Unable to create sprite.");
      this.onError?.(error);
      return { error: error.message };
    }
  }

  private bindEvents(sprite: SpriteResult | undefined) {
    const fileInput = this.container.querySelector<HTMLInputElement>(".mse-file-input");
    this.container
      .querySelector(".mse-upload")
      ?.addEventListener("click", () => fileInput?.click());
    fileInput?.addEventListener("change", () => {
      if (fileInput.files) {
        void this.addFiles(fileInput.files);
      }
      fileInput.value = "";
    });

    this.container.querySelector(".mse-clear")?.addEventListener("click", () => {
      this.icons = [];
      this.selectedIconId = undefined;
      this.render();
    });

    this.container.querySelector(".mse-export")?.addEventListener("click", () => {
      void this.exportZip(sprite);
    });

    this.container
      .querySelector<HTMLSelectElement>(".mse-logic")
      ?.addEventListener("change", (event) => {
        const currentSprite = this.resolveSpriteState().sprite;
        const nextLayoutMode = (event.currentTarget as HTMLSelectElement)
          .value as MapSpriteEditorLayout;
        if (nextLayoutMode === "custom") {
          this.freezeCustomPositions(currentSprite);
        } else {
          this.clearDragState();
        }
        this.layoutMode = nextLayoutMode;
        this.render();
      });

    this.container
      .querySelector<HTMLInputElement>(".mse-gap")
      ?.addEventListener("change", (event) => {
        const nextPadding = Number((event.currentTarget as HTMLInputElement).value);
        this.iconPadding = Number.isFinite(nextPadding) ? Math.max(0, Math.round(nextPadding)) : 0;
        if (this.isCustomLayout()) {
          this.reflowCustomPositions(this.icons);
        }
        this.render();
      });

    this.container
      .querySelector<HTMLInputElement>(".mse-preserve-order")
      ?.addEventListener("change", (event) => {
        this.preserveOrder = (event.currentTarget as HTMLInputElement).checked;
        if (!this.isCustomLayout()) {
          this.render();
        }
      });

    this.container
      .querySelector<HTMLSelectElement>(".mse-zoom")
      ?.addEventListener("change", (event) => {
        this.zoom = Number((event.currentTarget as HTMLSelectElement).value);
        this.render();
      });

    this.container
      .querySelector<HTMLInputElement>(".mse-theme")
      ?.addEventListener("input", (event) => {
        this.themeColor = normalizeThemeColor((event.currentTarget as HTMLInputElement).value);
        this.render();
      });

    this.bindListEvents(sprite);
    this.bindCanvasEvents(sprite);
    this.bindDetailEvents();
  }

  private bindListEvents(sprite: SpriteResult | undefined) {
    for (const row of this.container.querySelectorAll<HTMLElement>(".mse-row")) {
      const iconId = row.dataset.iconId;
      if (!iconId) {
        continue;
      }

      row.addEventListener("click", () => {
        this.selectedIconId = iconId;
        this.render();
      });

      row.addEventListener("dragstart", (event) => {
        if (!this.isCustomLayout()) {
          event.preventDefault();
          return;
        }
        event.dataTransfer?.setData("text/plain", iconId);
        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = "move";
        }
        this.draggedIconId = iconId;
      });

      row.addEventListener("dragover", (event) => event.preventDefault());
      row.addEventListener("dragenter", (event) => {
        event.preventDefault();
        if (!this.isCustomLayout()) {
          return;
        }
        const draggedIconId = this.draggedIconId ?? event.dataTransfer?.getData("text/plain");
        if (draggedIconId && draggedIconId !== iconId) {
          row.classList.add("is-drop-target");
          this.previewDropTarget(draggedIconId, iconId, sprite);
        }
      });
      row.addEventListener("dragleave", () => {
        row.classList.remove("is-drop-target");
      });
      row.addEventListener("drop", (event) => {
        event.preventDefault();
        row.classList.remove("is-drop-target");
        if (!this.isCustomLayout()) {
          return;
        }
        const draggedIconId = this.draggedIconId ?? event.dataTransfer?.getData("text/plain");
        this.clearDragState();
        if (draggedIconId) {
          this.reorderIcon(draggedIconId, iconId);
        }
      });
      row.addEventListener("dragend", () => {
        this.clearListDropTargets();
        this.clearDragState();
        const sprite = this.resolveSpriteState().sprite;
        void this.drawCanvas(sprite, this.selectedIconId);
      });

      row.querySelector(".mse-row-delete")?.addEventListener("click", (event) => {
        event.stopPropagation();
        this.removeIcon(iconId);
      });
    }
  }

  private bindCanvasEvents(sprite: SpriteResult | undefined) {
    const stage = this.container.querySelector<HTMLElement>(".mse-stage");
    const canvas = this.container.querySelector<HTMLCanvasElement>(".mse-canvas");

    stage?.addEventListener("dragover", (event) => event.preventDefault());
    stage?.addEventListener("drop", (event) => {
      event.preventDefault();
      if (event.dataTransfer?.files.length) {
        void this.addFiles(event.dataTransfer.files);
      }
    });

    if (!canvas || !sprite) {
      return;
    }

    canvas.addEventListener("mousedown", (event) => {
      const icon = this.hitTest(canvas, sprite, event);
      if (!icon) {
        if (this.selectedIconId) {
          this.selectedIconId = undefined;
          void this.drawCanvas(sprite, undefined);
        }
        return;
      }

      const shouldRedrawSelection =
        this.selectedIconId !== icon.id || this.dragPreviewTargetId !== undefined;
      this.selectedIconId = icon.id;
      this.clearDragState();
      if (this.isCustomLayout()) {
        this.pendingCanvasDrag = {
          iconId: icon.id,
          start: this.getCanvasPoint(canvas, sprite, event),
        };
      }
      if (shouldRedrawSelection) {
        void this.drawCanvas(sprite, icon.id);
      }
    });

    canvas.addEventListener("mousemove", (event) => {
      if (!this.isCustomLayout()) {
        return;
      }

      const pointer = this.getCanvasPoint(canvas, sprite, event);
      if (!this.draggedIconId && this.pendingCanvasDrag) {
        if (getDistance(pointer, this.pendingCanvasDrag.start) < 4 / this.zoom) {
          return;
        }
        this.draggedIconId = this.pendingCanvasDrag.iconId;
      }

      if (this.draggedIconId) {
        this.dragPointer = pointer;
      }

      this.hoveredIcon = this.hitTest(canvas, sprite, event);
      if (this.draggedIconId && this.hoveredIcon && this.hoveredIcon.id !== this.draggedIconId) {
        this.previewDropTarget(this.draggedIconId, this.hoveredIcon.id, sprite);
        return;
      }
      if (this.draggedIconId && this.dragPreviewTargetId) {
        this.dragPreviewTargetId = undefined;
        void this.drawCanvas(sprite, this.draggedIconId);
        return;
      }
      if (this.draggedIconId) {
        void this.drawCanvas(sprite, this.draggedIconId);
      }
    });

    canvas.addEventListener("mouseup", (event) => {
      if (!this.isCustomLayout()) {
        return;
      }
      if (!this.draggedIconId) {
        this.pendingCanvasDrag = undefined;
        return;
      }
      const draggedIconId = this.draggedIconId;
      const targetIcon = this.hitTest(canvas, sprite, event);
      const targetIconId = targetIcon?.id;
      const hadPreviewTarget = this.dragPreviewTargetId !== undefined;
      const hadDragPointer = this.dragPointer !== undefined;
      this.clearDragState();

      if (targetIconId && targetIconId !== draggedIconId) {
        this.reorderIcon(draggedIconId, targetIconId);
      } else if (hadPreviewTarget || hadDragPointer) {
        void this.drawCanvas(sprite, this.selectedIconId);
      }
    });

    canvas.addEventListener("mouseleave", () => {
      this.hoveredIcon = undefined;
      this.clearDragState();
      void this.drawCanvas(sprite, this.selectedIconId);
    });

    canvas.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      const icon = this.hitTest(canvas, sprite, event);
      if (icon) {
        this.removeIcon(icon.id);
      }
    });
  }

  private bindDetailEvents() {
    if (!this.selectedIconId) {
      return;
    }

    this.container.querySelector(".mse-rotate-left")?.addEventListener("click", () => {
      this.rotateIcon(this.selectedIconId!, -90);
    });
    this.container.querySelector(".mse-rotate-right")?.addEventListener("click", () => {
      this.rotateIcon(this.selectedIconId!, 90);
    });
  }

  private async addFiles(fileList: FileList | File[]) {
    const svgFiles = [...fileList].filter(
      (file) => file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg"),
    );
    if (svgFiles.length === 0) {
      this.setError("Select or drop at least one SVG file.");
      return;
    }

    try {
      const nextIcons = await Promise.all(
        svgFiles.map(async (file) => parseSvgText(await file.text(), file.name)),
      );
      const byName = new Map(this.icons.map((icon) => [icon.name, icon]));
      for (const icon of nextIcons) {
        byName.set(icon.name, icon);
      }
      this.icons = [...byName.values()];
      this.selectedIconId = nextIcons.at(-1)?.id;
      this.error = undefined;
      if (this.isCustomLayout()) {
        this.reflowCustomPositions(this.icons);
      }
      this.render();
    } catch (caught) {
      this.setError(caught instanceof Error ? caught.message : "Unable to import SVG files.");
    }
  }

  private async exportZip(sprite: SpriteResult | undefined) {
    if (!sprite || sprite.icons.length === 0) {
      this.setError("Add at least one SVG before exporting.");
      return;
    }

    try {
      const zipBlob = await exportSpriteZip(sprite);
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "map-sprite.zip";
      link.click();
      URL.revokeObjectURL(url);
      this.error = undefined;
    } catch (caught) {
      this.setError(caught instanceof Error ? caught.message : "Unable to export sprite ZIP.");
    }
  }

  private removeIcon(iconId: string) {
    this.icons = this.icons.filter((icon) => icon.id !== iconId);
    if (this.selectedIconId === iconId) {
      this.selectedIconId = undefined;
    }
    if (this.hoveredIcon?.id === iconId) {
      this.hoveredIcon = undefined;
    }
    if (this.isCustomLayout()) {
      this.reflowCustomPositions(this.icons);
    }
    this.render();
  }

  private rotateIcon(iconId: string, delta: 90 | -90) {
    this.icons = this.icons.map((icon) =>
      icon.id === iconId
        ? {
            ...icon,
            rotation: rotateBy(icon.rotation ?? 0, delta),
          }
        : icon,
    );
    if (this.isCustomLayout()) {
      this.reflowCustomPositions(this.icons);
    }
    this.render();
  }

  private reorderIcon(draggedIconId: string, targetIconId: string) {
    if (draggedIconId === targetIconId) {
      return;
    }

    const reorderedIcons = this.isCustomLayout()
      ? this.swapIconOrder(this.icons, draggedIconId, targetIconId)
      : this.reorderIcons(this.icons, draggedIconId, targetIconId);
    if (!reorderedIcons) {
      return;
    }

    this.icons = reorderedIcons;
    if (this.isCustomLayout()) {
      this.reflowCustomPositions(reorderedIcons);
    }
    this.selectedIconId = draggedIconId;
    this.render();
  }

  private reflowCustomPositions(icons: SvgIconInput[]) {
    const packedIcons = dedupeIconsByName(icons).map(toCustomPackedIcon);
    if (packedIcons.length === 0) {
      this.customPositions.clear();
      return;
    }

    const previousSprite = this.createCustomSpriteFromPositions();
    const maxRowWidth = Math.max(previousSprite.width, ...packedIcons.map((icon) => icon.width), 1);
    const nextPositions = new Map<string, CanvasPoint>();
    let x = 1;
    let y = 1;
    let rowHeight = 0;

    for (const icon of packedIcons) {
      if (x > 1 && x + icon.width > maxRowWidth) {
        x = 1;
        y += rowHeight + this.iconPadding;
        rowHeight = 0;
      }

      nextPositions.set(icon.id, { x, y });
      x += icon.width + this.iconPadding;
      rowHeight = Math.max(rowHeight, icon.height);
    }

    this.customPositions = nextPositions;
  }

  private previewDropTarget(draggedIconId: string, targetIconId: string, sprite?: SpriteResult) {
    if (draggedIconId === targetIconId) {
      return;
    }

    const targetIcon = sprite?.icons.find((icon) => icon.id === targetIconId);
    if (!sprite || !targetIcon) {
      return;
    }

    this.dragPreviewTargetId = targetIconId;
    void this.drawCanvas(sprite, draggedIconId, targetIconId);
  }

  private clearListDropTargets() {
    for (const row of this.container.querySelectorAll<HTMLElement>(".mse-row.is-drop-target")) {
      row.classList.remove("is-drop-target");
    }
  }

  private clearDragState() {
    this.pendingCanvasDrag = undefined;
    this.draggedIconId = undefined;
    this.dragPreviewTargetId = undefined;
    this.dragPointer = undefined;
  }

  private reorderIcons(icons: SvgIconInput[], draggedIconId: string, targetIconId: string) {
    const draggedIcon = icons.find((icon) => icon.id === draggedIconId);
    if (!draggedIcon) {
      return undefined;
    }

    const withoutDraggedIcon = icons.filter((icon) => icon.id !== draggedIconId);
    const targetIndex = withoutDraggedIcon.findIndex((icon) => icon.id === targetIconId);
    if (targetIndex < 0) {
      return undefined;
    }

    return [
      ...withoutDraggedIcon.slice(0, targetIndex),
      draggedIcon,
      ...withoutDraggedIcon.slice(targetIndex),
    ];
  }

  private swapIconOrder(icons: SvgIconInput[], draggedIconId: string, targetIconId: string) {
    const draggedIndex = icons.findIndex((icon) => icon.id === draggedIconId);
    const targetIndex = icons.findIndex((icon) => icon.id === targetIconId);
    if (draggedIndex < 0 || targetIndex < 0) {
      return undefined;
    }

    const swappedIcons = [...icons];
    [swappedIcons[draggedIndex], swappedIcons[targetIndex]] = [
      swappedIcons[targetIndex],
      swappedIcons[draggedIndex],
    ];
    return swappedIcons;
  }

  private setError(message: string) {
    this.error = message;
    this.onError?.(new Error(message));
    this.render();
  }

  private hitTest(canvas: HTMLCanvasElement, sprite: SpriteResult, event: MouseEvent) {
    const { x, y } = this.getCanvasPoint(canvas, sprite, event);

    return [...sprite.icons]
      .reverse()
      .find(
        (icon) =>
          x >= icon.x && x <= icon.x + icon.width && y >= icon.y && y <= icon.y + icon.height,
      );
  }

  private getCanvasPoint(
    canvas: HTMLCanvasElement,
    sprite: SpriteResult,
    event: MouseEvent,
  ): CanvasPoint {
    const rect = canvas.getBoundingClientRect();
    const logicalWidth = sprite.width > 0 ? sprite.width : 480;
    const logicalHeight = sprite.height > 0 ? sprite.height : 280;

    return {
      x: ((event.clientX - rect.left) / rect.width) * logicalWidth,
      y: ((event.clientY - rect.top) / rect.height) * logicalHeight,
    };
  }

  private async drawCanvas(
    sprite: SpriteResult | undefined,
    selectedIconId = this.selectedIconId,
    previewTargetId?: string,
  ) {
    const canvas = this.container.querySelector<HTMLCanvasElement>(".mse-canvas");
    if (!canvas) {
      return;
    }

    const logicalWidth = sprite && sprite.width > 0 ? sprite.width : 480;
    const logicalHeight = sprite && sprite.height > 0 ? sprite.height : 280;
    const devicePixelRatio = window.devicePixelRatio || 1;
    const scale = this.zoom * devicePixelRatio;
    const deviceWidth = Math.max(1, Math.round(logicalWidth * scale));
    const deviceHeight = Math.max(1, Math.round(logicalHeight * scale));
    const cssWidth = `${logicalWidth * this.zoom}px`;
    const cssHeight = `${logicalHeight * this.zoom}px`;

    if (canvas.width !== deviceWidth) {
      canvas.width = deviceWidth;
    }
    if (canvas.height !== deviceHeight) {
      canvas.height = deviceHeight;
    }
    if (canvas.style.width !== cssWidth) {
      canvas.style.width = cssWidth;
    }
    if (canvas.style.height !== cssHeight) {
      canvas.style.height = cssHeight;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    context.setTransform(scale, 0, 0, scale, 0, 0);
    context.clearRect(0, 0, logicalWidth, logicalHeight);

    if (!sprite || sprite.icons.length === 0) {
      context.fillStyle = "#64748b";
      context.font = "14px system-ui, sans-serif";
      context.fillText("Drop SVG files here", 24, 36);
      return;
    }

    for (const icon of sprite.icons) {
      const image = await this.loadPreviewImage(icon.svgText);
      const isDraggedIcon = icon.id === this.draggedIconId && this.dragPointer;
      drawCanvasIcon(context, image, icon, isDraggedIcon ? 0.35 : 1);
    }

    const previewTargetIcon = previewTargetId
      ? sprite.icons.find((icon) => icon.id === previewTargetId)
      : undefined;
    if (previewTargetIcon) {
      drawPreviewFrame(context, previewTargetIcon, this.zoom, this.themeColor);
    }

    const selectedIcon = sprite.icons.find((icon) => icon.id === selectedIconId);
    if (selectedIcon) {
      drawSelectionFrame(context, selectedIcon, this.zoom, this.themeColor);
    }

    const draggedIcon = this.draggedIconId
      ? sprite.icons.find((icon) => icon.id === this.draggedIconId)
      : undefined;
    if (draggedIcon && this.dragPointer) {
      const image = await this.loadPreviewImage(draggedIcon.svgText);
      drawDragGhost(context, image, draggedIcon, this.dragPointer, this.zoom, this.themeColor);
    }
  }

  private loadPreviewImage(svgText: string) {
    const cachedImage = this.previewImageCache.get(svgText);
    if (cachedImage) {
      return cachedImage;
    }

    const image = loadPreviewImage(svgText);
    this.previewImageCache.set(svgText, image);
    return image;
  }
}

function resolveContainer(container: HTMLElement | string) {
  return typeof container === "string" ? document.querySelector<HTMLElement>(container) : container;
}

function dedupeIconsByName(icons: SvgIconInput[]) {
  const iconsByName = new Map<string, SvgIconInput>();
  for (const icon of icons) {
    iconsByName.set(icon.name, icon);
  }
  return [...iconsByName.values()];
}

function toCustomPackedIcon(icon: SvgIconInput): PackedIcon {
  const rotation = normalizeRotation(icon.rotation);
  const rotatesBounds = rotation === 90 || rotation === 270;

  return {
    id: icon.id,
    name: icon.name,
    fileName: icon.fileName,
    svgText: icon.svgText,
    width: rotatesBounds ? icon.height : icon.width,
    height: rotatesBounds ? icon.width : icon.height,
    sourceWidth: icon.width,
    sourceHeight: icon.height,
    rotation,
    viewBox: icon.viewBox,
    x: 0,
    y: 0,
  };
}

function getCustomSpriteSize(icons: PackedIcon[], axis: "width" | "height") {
  if (icons.length === 0) {
    return 0;
  }

  return Math.ceil(
    Math.max(
      ...icons.map((icon) => (axis === "width" ? icon.x + icon.width : icon.y + icon.height)),
      0,
    ),
  );
}

function normalizeRotation(rotation: SvgIconInput["rotation"]): SpriteRotation {
  return rotation === 90 || rotation === 180 || rotation === 270 ? rotation : 0;
}

function getDistance(left: CanvasPoint, right: CanvasPoint) {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function injectStyles() {
  if (document.getElementById(styleElementId)) {
    return;
  }

  const style = document.createElement("style");
  style.id = styleElementId;
  style.textContent = editorStyles;
  document.head.append(style);
}

function rotateBy(rotation: SpriteRotation, delta: 90 | -90): SpriteRotation {
  const nextRotation = (rotation + delta + 360) % 360;
  return nextRotation === 90 || nextRotation === 180 || nextRotation === 270 ? nextRotation : 0;
}

function normalizeThemeColor(color: string | undefined) {
  if (!color) {
    return defaultThemeColor;
  }

  const trimmedColor = color.trim();
  return /^#[0-9a-fA-F]{6}$/.test(trimmedColor) ? trimmedColor.toLowerCase() : defaultThemeColor;
}

function loadPreviewImage(svgText: string): Promise<HTMLImageElement> {
  const image = new Image();

  return new Promise((resolve, reject) => {
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to draw SVG preview."));
    image.src = svgToDataUrl(svgText);
  });
}
