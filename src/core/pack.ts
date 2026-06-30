import { MaxRectsPacker, PACKING_LOGIC } from "maxrects-packer";
import { createSpriteJson } from "./sprite-json";
import type {
  PackedIcon,
  SpriteOptions,
  SpritePackingLogic,
  SpriteResult,
  SpriteRotation,
  SvgIconInput,
} from "./types";

const defaultSpriteOptions = {
  maxWidth: 1024,
  maxHeight: 1024,
  padding: 2,
  border: 1,
  smart: true,
  pot: false,
  square: false,
  allowRotation: false,
  logic: "max-edge",
  preserveOrder: false,
} as const;

type PackableIcon = SvgIconInput & {
  x: number;
  y: number;
  sourceWidth: number;
  sourceHeight: number;
  rotation: SpriteRotation;
  rot?: boolean;
  oversized?: boolean;
};

type PackedAttempt = {
  width: number;
  height: number;
  rects: PackableIcon[];
};

export function createSprite(icons: SvgIconInput[], options: SpriteOptions = {}): SpriteResult {
  const resolvedOptions = resolveSpriteOptions(options);
  const uniqueIcons = dedupeIconsByName(icons);

  if (uniqueIcons.length === 0) {
    return {
      width: 0,
      height: 0,
      icons: [],
      json: {},
    };
  }

  const packableIcons = uniqueIcons.map(toPackableIcon);

  for (const icon of packableIcons) {
    if (icon.width > resolvedOptions.maxWidth || icon.height > resolvedOptions.maxHeight) {
      throw new Error(
        `Icon "${icon.name}" (${icon.width}x${icon.height}) exceeds the sprite bounds ${resolvedOptions.maxWidth}x${resolvedOptions.maxHeight}.`,
      );
    }
  }

  const packedAttempt = resolvedOptions.preserveOrder
    ? packInOrder(packableIcons, resolvedOptions)
    : packCompact(packableIcons, resolvedOptions);

  if (!packedAttempt) {
    throw new Error(
      `Icons could not fit into a single sprite within ${resolvedOptions.maxWidth}x${resolvedOptions.maxHeight}.`,
    );
  }

  const orderIndexById = new Map(packableIcons.map((icon, index) => [icon.id, index]));
  const packedIcons = packedAttempt.rects.map(toPackedIcon).sort((left, right) => {
    if (resolvedOptions.preserveOrder) {
      return (orderIndexById.get(left.id) ?? 0) - (orderIndexById.get(right.id) ?? 0);
    }

    if (left.y !== right.y) {
      return left.y - right.y;
    }

    return left.x - right.x;
  });

  return {
    width: packedAttempt.width,
    height: packedAttempt.height,
    icons: packedIcons,
    json: createSpriteJson(packedIcons, 1),
  };
}

export function resolveSpriteOptions(options: SpriteOptions = {}): Required<SpriteOptions> {
  if (options.allowRotation === true) {
    throw new Error("Sprite icon rotation is not supported. Set allowRotation to false.");
  }

  return {
    ...defaultSpriteOptions,
    ...options,
    allowRotation: false,
  };
}

function packInOrder(
  icons: PackableIcon[],
  options: Required<SpriteOptions>,
): PackedAttempt | undefined {
  return packOrderedIcons(
    icons,
    options,
    icons.map((_, index) => index),
    options.maxWidth,
  );
}

function packCompact(
  icons: PackableIcon[],
  options: Required<SpriteOptions>,
): PackedAttempt | undefined {
  let bestAttempt: PackedAttempt | undefined;

  for (const order of getCompactOrderCandidates(icons, options.logic)) {
    for (const maxWidth of getCompactWidthCandidates(icons, options)) {
      const attempt = packOrderedIcons(icons, options, order, maxWidth);
      if (attempt && isBetterPackedAttempt(attempt, bestAttempt)) {
        bestAttempt = attempt;
      }
    }
  }

  return bestAttempt;
}

function packOrderedIcons(
  icons: PackableIcon[],
  options: Required<SpriteOptions>,
  order: number[],
  maxWidth: number,
): PackedAttempt | undefined {
  const orderedIcons = order.map((index) => clonePackableIcon(icons[index]));
  const packer = new MaxRectsPacker<PackableIcon>(maxWidth, options.maxHeight, options.padding, {
    smart: options.smart,
    pot: options.pot,
    square: options.square,
    allowRotation: false,
    border: options.border,
    logic: toPackerLogic(options.logic),
  });

  for (const icon of orderedIcons) {
    packer.add(icon);
  }

  if (packer.bins.length !== 1) {
    return undefined;
  }

  const [bin] = packer.bins;
  if (
    bin.rects.length !== orderedIcons.length ||
    bin.width > options.maxWidth ||
    bin.height > options.maxHeight
  ) {
    return undefined;
  }

  return {
    width: bin.width,
    height: bin.height,
    rects: bin.rects,
  };
}

function clonePackableIcon(icon: PackableIcon): PackableIcon {
  return {
    ...icon,
    x: 0,
    y: 0,
    rot: undefined,
    oversized: undefined,
  };
}

function getCompactOrderCandidates(icons: PackableIcon[], logic: SpritePackingLogic): number[][] {
  const bySelectedLogic =
    logic === "max-area"
      ? compareBy((icon) => icon.width * icon.height)
      : compareBy((icon) => Math.max(icon.width, icon.height));

  return dedupeOrders([
    sortIconIndexes(icons, bySelectedLogic),
    sortIconIndexes(
      icons,
      compareBy((icon) => Math.max(icon.width, icon.height)),
    ),
    sortIconIndexes(
      icons,
      compareBy((icon) => icon.width * icon.height),
    ),
    sortIconIndexes(
      icons,
      compareBy((icon) => icon.width),
    ),
    sortIconIndexes(
      icons,
      compareBy((icon) => icon.height),
    ),
    sortIconIndexes(
      icons,
      compareBy((icon) => icon.width + icon.height),
    ),
    sortIconIndexes(
      icons,
      compareBy((icon) => icon.width / icon.height),
    ),
    sortIconIndexes(
      icons,
      compareBy((icon) => icon.height / icon.width),
    ),
  ]);
}

function compareBy(metric: (icon: PackableIcon) => number) {
  return (left: PackableIcon, right: PackableIcon) => {
    const metricDelta = metric(right) - metric(left);
    if (metricDelta !== 0) {
      return metricDelta;
    }

    return right.width * right.height - left.width * left.height;
  };
}

function sortIconIndexes(
  icons: PackableIcon[],
  compare: (left: PackableIcon, right: PackableIcon) => number,
): number[] {
  return icons
    .map((icon, index) => ({ icon, index }))
    .sort((left, right) => compare(left.icon, right.icon))
    .map(({ index }) => index);
}

function dedupeOrders(orders: number[][]): number[][] {
  const seen = new Set<string>();
  return orders.filter((order) => {
    const key = order.join(",");
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function getCompactWidthCandidates(
  icons: PackableIcon[],
  options: Required<SpriteOptions>,
): number[] {
  if (!options.smart) {
    return [options.maxWidth];
  }

  const largestIconWidth = Math.max(...icons.map((icon) => icon.width));
  const paddedArea = icons.reduce(
    (area, icon) => area + (icon.width + options.padding) * (icon.height + options.padding),
    0,
  );
  const targetWidth = Math.ceil(Math.sqrt(paddedArea));
  const widths = new Set([largestIconWidth, targetWidth, options.maxWidth]);

  let steppedWidth = largestIconWidth;
  while (steppedWidth < options.maxWidth) {
    widths.add(steppedWidth);
    steppedWidth = Math.max(steppedWidth + 1, Math.ceil(steppedWidth * 1.25));
  }

  let rowWidth = 0;
  for (const icon of [...icons].sort(compareBy((icon) => Math.max(icon.width, icon.height)))) {
    rowWidth += rowWidth === 0 ? icon.width : icon.width + options.padding;
    if (rowWidth <= options.maxWidth) {
      widths.add(rowWidth);
    }
  }

  return [...widths]
    .filter((width) => width >= largestIconWidth && width <= options.maxWidth)
    .sort((left, right) => left - right);
}

function isBetterPackedAttempt(
  attempt: PackedAttempt,
  currentBest: PackedAttempt | undefined,
): boolean {
  if (!currentBest) {
    return true;
  }

  const attemptArea = attempt.width * attempt.height;
  const currentArea = currentBest.width * currentBest.height;
  if (attemptArea !== currentArea) {
    return attemptArea < currentArea;
  }

  const attemptLongestEdge = Math.max(attempt.width, attempt.height);
  const currentLongestEdge = Math.max(currentBest.width, currentBest.height);
  if (attemptLongestEdge !== currentLongestEdge) {
    return attemptLongestEdge < currentLongestEdge;
  }

  return attempt.width + attempt.height < currentBest.width + currentBest.height;
}

function toPackerLogic(logic: SpritePackingLogic): PACKING_LOGIC {
  return logic === "max-area" ? PACKING_LOGIC.MAX_AREA : PACKING_LOGIC.MAX_EDGE;
}

function dedupeIconsByName(icons: SvgIconInput[]): SvgIconInput[] {
  const byName = new Map<string, SvgIconInput>();

  for (const icon of icons) {
    byName.set(icon.name, icon);
  }

  return [...byName.values()];
}

function toPackableIcon(icon: SvgIconInput): PackableIcon {
  const rotation = normalizeRotation(icon.rotation);
  const rotatesBounds = rotation === 90 || rotation === 270;

  return {
    ...icon,
    sourceWidth: icon.width,
    sourceHeight: icon.height,
    width: rotatesBounds ? icon.height : icon.width,
    height: rotatesBounds ? icon.width : icon.height,
    rotation,
    x: 0,
    y: 0,
  };
}

function normalizeRotation(rotation: SvgIconInput["rotation"]): SpriteRotation {
  return rotation === 90 || rotation === 180 || rotation === 270 ? rotation : 0;
}

function toPackedIcon(rect: PackableIcon): PackedIcon {
  if (rect.oversized) {
    throw new Error(`Icon "${rect.name}" is too large for the configured sprite bounds.`);
  }

  if (rect.rot) {
    throw new Error(`Icon "${rect.name}" was rotated during packing, which is not supported.`);
  }

  if (typeof rect.x !== "number" || typeof rect.y !== "number") {
    throw new Error(`Icon "${rect.name}" was not assigned a packed position.`);
  }

  return {
    id: rect.id,
    name: rect.name,
    fileName: rect.fileName,
    svgText: rect.svgText,
    width: rect.width,
    height: rect.height,
    sourceWidth: rect.sourceWidth,
    sourceHeight: rect.sourceHeight,
    rotation: rect.rotation,
    viewBox: rect.viewBox,
    x: rect.x,
    y: rect.y,
  };
}
