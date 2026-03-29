// Meme element renderer — draws meme elements on the main canvas.
// Uses cached bitmaps when available, falls back to live rendering.

import type { MemeElement } from './types';
import type { BoundingBox } from '../../types/primitives';
import type { RenderOptions } from '../registry/ElementPlugin';
import { renderMemeToCanvas } from './templates';

const imageCache = new Map<string, HTMLImageElement>();

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
    // Show loading state
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, element.width, element.height);
    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 4]);
    ctx.strokeRect(0, 0, element.width, element.height);
    ctx.setLineDash([]);

    // Loading text
    ctx.fillStyle = '#888888';
    ctx.font = '18px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Generating meme...', element.width / 2, element.height / 2);

    // Spinning indicator
    const t = (Date.now() % 1000) / 1000;
    const angle = t * Math.PI * 2;
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(element.width / 2, element.height / 2 + 30, 12, angle, angle + Math.PI * 1.5);
    ctx.stroke();

    ctx.restore();
    return;
  }

  if (element.bitmapDataUrl) {
    // Use cached bitmap
    let img = imageCache.get(element.id);
    if (!img || img.src !== element.bitmapDataUrl) {
      img = new Image();
      img.src = element.bitmapDataUrl;
      imageCache.set(element.id, img);
    }
    if (img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, 0, 0, element.width, element.height);
    } else {
      // Image still loading — render live
      renderMemeToCanvas(ctx, element.category, element.variant || '', element.texts, element.width, element.height);
    }
  } else {
    // No bitmap cache — render live
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
