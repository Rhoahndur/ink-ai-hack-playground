// Shared meme utilities — functions used by both useMemeMode and lasso meme generation.

import type { Stroke } from '../../types';
import type { BoundingBox } from '../../types/primitives';
import { renderStroke } from '../../canvas/StrokeRenderer';
import { getStrokesBoundingBox } from '../index';

/** Render strokes to an offscreen canvas and return as data URL */
export function strokesToImage(strokes: Stroke[], padding = 20): { dataUrl: string; bounds: BoundingBox } {
  const rawBounds = getStrokesBoundingBox(strokes);
  if (!rawBounds) {
    return { dataUrl: '', bounds: { left: 0, top: 0, right: 100, bottom: 100 } };
  }

  const left = rawBounds.left - padding;
  const top = rawBounds.top - padding;
  const right = rawBounds.right + padding;
  const bottom = rawBounds.bottom + padding;

  const width = Math.max(right - left, 100);
  const height = Math.max(bottom - top, 100);

  const canvas = document.createElement('canvas');
  canvas.width = Math.min(width, 800);
  canvas.height = Math.min(height, 800);
  const ctx = canvas.getContext('2d');
  if (!ctx) return { dataUrl: '', bounds: { left, top, right, bottom } };

  const scale = Math.min(canvas.width / width, canvas.height / height);

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.scale(scale, scale);
  ctx.translate(-left, -top);
  for (const stroke of strokes) {
    renderStroke(ctx, stroke);
  }
  ctx.restore();

  const dataUrl = canvas.toDataURL('image/png');
  // Release GPU-backed buffer promptly
  canvas.width = 0;
  canvas.height = 0;

  return { dataUrl, bounds: { left, top, right, bottom } };
}
