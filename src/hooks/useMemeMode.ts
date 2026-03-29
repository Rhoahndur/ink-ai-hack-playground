// useMemeMode — manages the meme interpretation pipeline.
//
// When meme mode is active, new strokes are captured as an image after debounce,
// sent to a vision model, and replaced with a rendered MemeElement.

import { useCallback, useRef, useState } from 'react';
import type { Stroke, NoteElements } from '../types';
import type { MemeElement } from '../elements/meme/types';
import { createMemeElement } from '../elements/meme/types';
import { renderMemeToBitmap } from '../elements/meme/templates';
import { interpretSketch, generateMemeImage } from '../elements/meme/memeService';
import { renderStroke } from '../canvas/StrokeRenderer';
import { getStrokesBoundingBox } from '../elements';
import { debugLog } from '../debug/DebugLogger';
import { createStrokeElement } from '../elements/stroke/types';

/** Render strokes to an offscreen canvas and return as data URL */
function strokesToImage(strokes: Stroke[], padding = 20): { dataUrl: string; bounds: { left: number; top: number; right: number; bottom: number } } {
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

export interface UseMemeMode {
  memeModeRef: React.RefObject<boolean>;
  memeMode: boolean;
  setMemeMode: (on: boolean) => void;
  toggleMemeMode: () => void;
  processMemeModeStrokes: (
    strokes: Stroke[],
    setCurrentNote: (updater: (prev: NoteElements) => NoteElements) => void,
  ) => Promise<void>;
  isInterpreting: boolean;
}

export function useMemeMode(): UseMemeMode {
  const [memeMode, setMemeModeState] = useState(false);
  const memeModeRef = useRef(false);
  const [isInterpreting, setIsInterpreting] = useState(false);
  const interpretingRef = useRef(false);
  // Queue strokes that arrive while an interpretation is in progress
  const pendingStrokesRef = useRef<Stroke[]>([]);
  const pendingSetNoteRef = useRef<((updater: (prev: NoteElements) => NoteElements) => void) | null>(null);

  const setMemeMode = useCallback((on: boolean) => {
    memeModeRef.current = on;
    setMemeModeState(on);
  }, []);

  const toggleMemeMode = useCallback(() => {
    const next = !memeModeRef.current;
    memeModeRef.current = next;
    setMemeModeState(next);
  }, []);

  const processMemeModeStrokes = useCallback(async (
    strokes: Stroke[],
    setCurrentNote: (updater: (prev: NoteElements) => NoteElements) => void,
  ) => {
    if (strokes.length === 0) return;

    // If already interpreting, queue these strokes for after current finishes
    if (interpretingRef.current) {
      debugLog.info('Meme mode: queuing strokes (interpretation in progress)', { count: strokes.length });
      pendingStrokesRef.current = [...pendingStrokesRef.current, ...strokes];
      pendingSetNoteRef.current = setCurrentNote;
      return;
    }

    debugLog.info('Meme mode: processing strokes', { count: strokes.length });
    interpretingRef.current = true;
    setIsInterpreting(true);

    const tempElement = createStrokeElement(strokes);
    const { dataUrl, bounds } = strokesToImage(strokes);

    const memeWidth = Math.min(Math.max(bounds.right - bounds.left, 300), 500);
    const memeHeight = Math.min(Math.max(bounds.bottom - bounds.top, 300), 500);
    const placeholder = createMemeElement(
      bounds.left,
      bounds.top,
      'impact',
      [],
      memeWidth,
      memeHeight,
    );
    placeholder.isGenerating = true;

    // Add both temp strokes (visible) and placeholder (shows loading)
    setCurrentNote(prev => ({
      ...prev,
      elements: [...prev.elements, tempElement, placeholder],
    }));

    try {
      if (!dataUrl) {
        throw new Error('Failed to capture strokes as image');
      }

      const interpretation = await interpretSketch(dataUrl);
      debugLog.info('Meme interpretation result', interpretation);

      const finalWidth = interpretation.width || memeWidth;
      const finalHeight = interpretation.height || memeHeight;

      // Try AI image generation first (high fidelity), fall back to procedural templates
      let bitmapDataUrl: string | null = null;
      try {
        debugLog.info('Attempting AI image generation...');
        bitmapDataUrl = await generateMemeImage(interpretation, dataUrl);
        if (bitmapDataUrl) {
          debugLog.info('AI image generation succeeded!');
        }
      } catch (err) {
        debugLog.warn('AI image generation failed, using procedural template', err);
      }

      // Fall back to procedural canvas rendering
      if (!bitmapDataUrl) {
        debugLog.info('Using procedural template fallback');
        bitmapDataUrl = renderMemeToBitmap(
          interpretation.category,
          interpretation.variant || '',
          interpretation.texts,
          finalWidth,
          finalHeight,
        );
      }

      const finalMeme: MemeElement = {
        ...placeholder,
        category: interpretation.category,
        variant: interpretation.variant,
        texts: interpretation.texts,
        width: finalWidth,
        height: finalHeight,
        bitmapDataUrl,
        sourceDescription: interpretation.description,
        isGenerating: false,
      };

      // Remove temp strokes + replace placeholder with final meme
      setCurrentNote(prev => ({
        ...prev,
        elements: prev.elements
          .filter(el => el.id !== tempElement.id)
          .map(el => el.id === placeholder.id ? finalMeme : el),
      }));

    } catch (err) {
      debugLog.error('Meme interpretation failed', err);

      // Remove placeholder, keep temp strokes so user's drawing isn't lost
      setCurrentNote(prev => ({
        ...prev,
        elements: prev.elements.filter(el => el.id !== placeholder.id),
      }));
    } finally {
      interpretingRef.current = false;
      setIsInterpreting(false);

      // Process any strokes that arrived while we were interpreting
      if (pendingStrokesRef.current.length > 0 && pendingSetNoteRef.current) {
        const queued = pendingStrokesRef.current;
        const queuedSetNote = pendingSetNoteRef.current;
        pendingStrokesRef.current = [];
        pendingSetNoteRef.current = null;
        debugLog.info('Meme mode: processing queued strokes', { count: queued.length });
        processMemeModeStrokes(queued, queuedSetNote);
      }
    }
  }, []);

  return {
    memeModeRef,
    memeMode,
    setMemeMode,
    toggleMemeMode,
    processMemeModeStrokes,
    isInterpreting,
  };
}
