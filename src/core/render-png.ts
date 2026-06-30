import type { PackedIcon, RenderSpriteOptions, SpriteResult } from "./types";
import { svgToDataUrl } from "./svg-data-url";

export async function renderSpritePng(
  sprite: SpriteResult,
  options: RenderSpriteOptions = {},
): Promise<Blob> {
  const pixelRatio = options.pixelRatio ?? 1;

  if (pixelRatio !== 1 && pixelRatio !== 2) {
    throw new Error("renderSpritePng only supports pixelRatio 1 or 2.");
  }

  if (typeof document === "undefined") {
    throw new Error("renderSpritePng requires a browser-like document.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = sprite.width * pixelRatio;
  canvas.height = sprite.height * pixelRatio;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Unable to create a 2D canvas context.");
  }

  context.clearRect(0, 0, canvas.width, canvas.height);

  for (const icon of sprite.icons) {
    const image = await loadSvgImage(icon.svgText);
    drawRotatedIcon(context, image, icon, pixelRatio);
  }

  return canvasToBlob(canvas);
}

function drawRotatedIcon(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  icon: PackedIcon,
  pixelRatio: number,
) {
  context.save();
  context.translate(icon.x * pixelRatio, icon.y * pixelRatio);
  context.scale(pixelRatio, pixelRatio);

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

function loadSvgImage(svgText: string): Promise<HTMLImageElement> {
  const image = new Image();

  return new Promise((resolve, reject) => {
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to decode SVG image for PNG rendering."));
    image.src = svgToDataUrl(svgText);
  });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Unable to export sprite canvas to PNG."));
        return;
      }

      resolve(blob);
    }, "image/png");
  });
}
