import type { PackedIcon } from "../core";

export type CanvasPoint = {
  x: number;
  y: number;
};

export function drawPreviewFrame(
  context: CanvasRenderingContext2D,
  icon: PackedIcon,
  zoom: number,
  color: string,
) {
  const lineWidth = 2 / zoom;
  const inset = lineWidth / 2;

  context.save();
  context.strokeStyle = color;
  context.lineWidth = lineWidth;
  context.setLineDash([4 / zoom, 3 / zoom]);
  context.strokeRect(
    icon.x + inset,
    icon.y + inset,
    Math.max(0, icon.width - lineWidth),
    Math.max(0, icon.height - lineWidth),
  );
  context.restore();
}

export function drawCanvasIcon(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  icon: PackedIcon,
  opacity = 1,
) {
  context.save();
  context.globalAlpha = opacity;
  context.translate(icon.x, icon.y);

  if (icon.rotation === 90) {
    context.translate(icon.width, 0);
    context.rotate(Math.PI / 2);
  } else if (icon.rotation === 180) {
    context.translate(icon.width, icon.height);
    context.rotate(Math.PI);
  } else if (icon.rotation === 270) {
    context.translate(0, icon.height);
    context.rotate(-Math.PI / 2);
  }

  context.drawImage(image, 0, 0, icon.sourceWidth, icon.sourceHeight);
  context.restore();
}

export function drawDragGhost(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  icon: PackedIcon,
  pointer: CanvasPoint,
  zoom: number,
  color: string,
) {
  const x = pointer.x - icon.width / 2;
  const y = pointer.y - icon.height / 2;
  const lineWidth = 1.5 / zoom;
  const padding = 3 / zoom;

  context.save();
  context.globalAlpha = 0.78;
  context.fillStyle = "rgba(255, 255, 255, 0.72)";
  context.strokeStyle = hexToRgba(color, 0.72);
  context.lineWidth = lineWidth;
  context.shadowColor = "rgba(15, 23, 42, 0.18)";
  context.shadowBlur = 8 / zoom;
  context.shadowOffsetY = 3 / zoom;
  context.beginPath();
  context.roundRect(
    x - padding,
    y - padding,
    icon.width + padding * 2,
    icon.height + padding * 2,
    Math.min(6 / zoom, Math.min(icon.width, icon.height) / 2),
  );
  context.fill();
  context.stroke();
  context.restore();

  drawCanvasIcon(context, image, { ...icon, x, y }, 0.9);
}

export function drawSelectionFrame(
  context: CanvasRenderingContext2D,
  icon: PackedIcon,
  zoom: number,
  color: string,
) {
  const lineWidth = 2 / zoom;
  const inset = lineWidth / 2;

  context.save();
  context.strokeStyle = color;
  context.lineWidth = lineWidth;
  context.lineJoin = "miter";
  context.strokeRect(
    icon.x + inset,
    icon.y + inset,
    Math.max(0, icon.width - lineWidth),
    Math.max(0, icon.height - lineWidth),
  );
  context.restore();
}

function hexToRgba(color: string, alpha: number) {
  const red = Number.parseInt(color.slice(1, 3), 16);
  const green = Number.parseInt(color.slice(3, 5), 16);
  const blue = Number.parseInt(color.slice(5, 7), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}
