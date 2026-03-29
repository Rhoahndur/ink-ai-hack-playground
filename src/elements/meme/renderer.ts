// Meme element renderer — draws meme elements on the main canvas.

import type { MemeElement } from './types';
import type { BoundingBox } from '../../types/primitives';
import type { RenderOptions } from '../registry/ElementPlugin';
import { renderMemeToCanvas } from './templates';

const MAX_CACHE_SIZE = 10;
const imageCache = new Map<string, HTMLImageElement>();

function getOrLoadImage(key: string, src: string): HTMLImageElement | null {
  const existing = imageCache.get(key);
  if (existing && existing.src === src) return existing;

  // Evict oldest if at capacity
  if (imageCache.size >= MAX_CACHE_SIZE) {
    const firstKey = imageCache.keys().next().value;
    if (firstKey !== undefined) imageCache.delete(firstKey);
  }

  const img = new Image();
  img.src = src;
  imageCache.set(key, img);
  return img;
}

export function render(
  ctx: CanvasRenderingContext2D,
  element: MemeElement,
  _options?: RenderOptions, // eslint-disable-line @typescript-eslint/no-unused-vars
): void {
  const tx = element.transform.values[6];
  const ty = element.transform.values[7];

  ctx.save();
  ctx.translate(tx, ty);

  if (element.isGenerating) {
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, element.width, element.height);
    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 4]);
    ctx.strokeRect(0, 0, element.width, element.height);
    ctx.setLineDash([]);

    ctx.fillStyle = '#888888';
    ctx.font = '18px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Generating meme...', element.width / 2, element.height / 2);

    ctx.restore();
    return;
  }

  if (element.bitmapDataUrl) {
    const img = getOrLoadImage(element.id, element.bitmapDataUrl);
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, 0, 0, element.width, element.height);
    } else {
      renderMemeToCanvas(ctx, element.category, element.variant || '', element.texts, element.width, element.height);
    }
  } else {
    renderMemeToCanvas(ctx, element.category, element.variant || '', element.texts, element.width, element.height);
  }

  ctx.restore();
}

export function getBounds(element: MemeElement): BoundingBox | null {
  const tx = element.transform.values[6];
  const ty = element.transform.values[7];
  return {
    left: tx,
    top: ty,
    right: tx + element.width,
    bottom: ty + element.height,
  };
}
