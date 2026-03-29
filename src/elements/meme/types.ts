// MemeElement: AI-interpreted meme generated from hand-drawn sketches
//
// User draws a rough sketch + text, vision model interprets it,
// and we render a clean meme with template images + styled text.

import type { TransformableElement } from '../../types/primitives';
import { generateId } from '../../types/primitives';

export type MemeCategory =
  | 'pepe'         // Pepe/Apu frogs
  | 'wojak'        // Wojak/Chad faces
  | 'drake'        // Drake approve/disapprove two-panel
  | 'brain'        // Expanding brain multi-panel
  | 'impact';      // Classic top/bottom Impact text

export type PepeVariant = 'smug' | 'sad' | 'angry' | 'happy' | 'thinking' | 'comfy';
export type WojakVariant = 'doomer' | 'bloomer' | 'chad' | 'soyjak' | 'crying';

export interface MemeText {
  text: string;
  position: 'top' | 'bottom' | 'custom';
  x?: number;  // 0-1 relative position (for custom)
  y?: number;
  fontSize?: number;
}

export interface MemeElement extends TransformableElement {
  type: 'meme';
  category: MemeCategory;
  variant?: string;           // e.g. 'smug', 'chad', 'approve'
  texts: MemeText[];
  width: number;
  height: number;
  // Pre-rendered bitmap cache (avoids re-drawing templates every frame)
  bitmapDataUrl?: string;
  // Source info for regeneration
  sourceDescription?: string;
  isGenerating?: boolean;
}

export function createMemeElement(
  canvasX: number,
  canvasY: number,
  category: MemeCategory,
  texts: MemeText[],
  width = 400,
  height = 400,
): MemeElement {
  return {
    type: 'meme',
    id: generateId(),
    transform: {
      values: [1, 0, 0, 0, 1, 0, canvasX, canvasY, 1],
    },
    category,
    texts,
    width,
    height,
  };
}
