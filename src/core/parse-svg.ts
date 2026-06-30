import { normalizeIconName } from "./normalize";
import type { SvgIconInput } from "./types";

const svgTagPattern = /<svg\b[^>]*>/i;
const unsafeSvgPattern =
  /<\s*script\b|<\s*foreignObject\b|\son[a-z]+\s*=|\s(?:href|xlink:href)\s*=\s*["'](?:https?:|data:|javascript:)/i;

export function parseSvgText(svgText: string, fileName: string): SvgIconInput {
  const trimmed = svgText.trim();

  if (!trimmed) {
    throw new Error(`SVG file "${fileName}" is empty.`);
  }

  if (unsafeSvgPattern.test(trimmed)) {
    throw new Error(`Unsafe SVG content in "${fileName}".`);
  }

  const svgTag = trimmed.match(svgTagPattern)?.[0];
  if (!svgTag) {
    throw new Error(`SVG file "${fileName}" does not contain an <svg> root.`);
  }

  const styleDimensions = parseStyleDimensions(readAttribute(svgTag, "style"));
  const width = parseLength(readAttribute(svgTag, "width")) ?? styleDimensions.width;
  const height = parseLength(readAttribute(svgTag, "height")) ?? styleDimensions.height;
  const viewBox = readAttribute(svgTag, "viewBox") ?? readAttribute(svgTag, "viewbox");
  const viewBoxSize = parseViewBox(viewBox);

  const resolvedWidth = width ?? viewBoxSize?.width;
  const resolvedHeight = height ?? viewBoxSize?.height;

  if (!isPositiveNumber(resolvedWidth) || !isPositiveNumber(resolvedHeight)) {
    throw new Error(
      `SVG file "${fileName}" must provide positive width/height or a usable viewBox.`,
    );
  }

  const name = normalizeIconName(fileName);

  return {
    id: `${name}-${hashText(`${fileName}:${trimmed}`)}`,
    name,
    fileName,
    svgText: trimmed,
    width: Math.ceil(resolvedWidth),
    height: Math.ceil(resolvedHeight),
    viewBox,
  };
}

function readAttribute(svgTag: string, attributeName: string): string | undefined {
  const pattern = new RegExp(`${attributeName}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i");
  const match = svgTag.match(pattern);
  return match?.[2] ?? match?.[3];
}

function parseLength(value: string | undefined): number | undefined {
  if (!value || value.trim().endsWith("%")) {
    return undefined;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseStyleDimensions(style: string | undefined): {
  width?: number;
  height?: number;
} {
  if (!style) {
    return {};
  }

  return {
    width: parseLength(readStyleDeclaration(style, "width")),
    height: parseLength(readStyleDeclaration(style, "height")),
  };
}

function readStyleDeclaration(style: string, propertyName: "width" | "height"): string | undefined {
  const declarations = style.split(";");

  for (const declaration of declarations) {
    const [name, ...valueParts] = declaration.split(":");
    if (name?.trim().toLowerCase() === propertyName) {
      return valueParts.join(":").trim();
    }
  }

  return undefined;
}

function parseViewBox(value: string | undefined): { width: number; height: number } | undefined {
  if (!value) {
    return undefined;
  }

  const parts = value
    .trim()
    .split(/[\s,]+/)
    .map((part) => Number.parseFloat(part));

  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) {
    return undefined;
  }

  const [, , width, height] = parts;
  return { width, height };
}

function isPositiveNumber(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function hashText(value: string): string {
  let hash = 5381;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }

  return (hash >>> 0).toString(36);
}
