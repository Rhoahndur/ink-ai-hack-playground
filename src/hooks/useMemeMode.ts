// useMemeMode — manages the meme interpretation pipeline.
//
// When meme mode is active:
// - New strokes are captured as an image after debounce
// - Vision model interprets the sketch and returns a meme spec
// - Strokes are replaced with a rendered MemeElement
//
// Also supports long-press (hold) to interpret the entire canvas scene.

import { useCallback, useRef, useState } from 'react';
import type { Stroke, NoteElements } from '../types';
import type { MemeElement } from '../elements/meme/types';
import { createMemeElement } from '../elements/meme/types';
import { renderMemeToBitmap } from '../elements/meme/templates';
import { interpretSketch, interpretScene } from '../elements/meme/memeService';
import { renderStroke } from '../canvas/StrokeRenderer';
import { debugLog } from '../debug/DebugLogger';
import { createStrokeElement } from '../elements/stroke/types';

/** Render strokes to an offscreen canvas and return as data URL */
function strokesToImage(strokes: Stroke[], padding = 20): { dataUrl: string; bounds: { left: number; top: number; right: number; bottom: number } } {
  // Calculate bounding box of all strokes
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (const stroke of strokes) {
    for (const input of stroke.inputs.inputs) {
      left = Math.min(left, input.x);
      top = Math.min(top, input.y);
      right = Math.max(right, input.x);
      bottom = Math.max(bottom, input.y);
    }
  }

  if (!isFinite(left)) {
    return { dataUrl: '', bounds: { left: 0, top: 0, right: 100, bottom: 100 } };
  }

  left -= padding;
  top -= padding;
  right += padding;
  bottom += padding;

  const width = Math.max(right - left, 100);
  const height = Math.max(bottom - top, 100);

  const canvas = document.createElement('canvas');
  canvas.width = Math.min(width, 800);  // Cap size for API
  canvas.height = Math.min(height, 800);
  const ctx = canvas.getContext('2d');
  if (!ctx) return { dataUrl: '', bounds: { left, top, right, bottom } };

  // Scale to fit
  const scale = Math.min(canvas.width / width, canvas.height / height);

  // White background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw strokes
  ctx.save();
  ctx.scale(scale, scale);
  ctx.translate(-left, -top);
  for (const stroke of strokes) {
    renderStroke(ctx, stroke);
  }
  ctx.restore();

  return { dataUrl: canvas.toDataURL('image/png'), bounds: { left, top, right, bottom } };
}

/** Render all elements + strokes on a canvas to an image */
function canvasToImage(canvasElement: HTMLCanvasElement | null): string {
  if (!canvasElement) return '';
  try {
    return canvasElement.toDataURL('image/png');
  } catch {
    return '';
  }
}

export interface UseMemeMode {
  memeMode: boolean;
  setMemeMode: (on: boolean) => void;
  toggleMemeMode: () => void;
  /** Process strokes in meme mode — called instead of normal processStrokes */
  processMemeModeStrokes: (
    strokes: Stroke[],
    currentNote: NoteElements,
    setCurrentNote: (note: NoteElements) => void,
  ) => Promise<void>;
  /** Interpret the full scene from a canvas ref */
  interpretFullScene: (
    canvasRef: HTMLCanvasElement | null,
    currentNote: NoteElements,
    setCurrentNote: (note: NoteElements) => void,
  ) => Promise<void>;
  isInterpreting: boolean;
}

export function useMemeMode(): UseMemeMode {
  const [memeMode, setMemeMode] = useState(false);
  const [isInterpreting, setIsInterpreting] = useState(false);
  const interpretingRef = useRef(false);

  const toggleMemeMode = useCallback(() => {
    setMemeMode(prev => !prev);
  }, []);

  const processMemeModeStrokes = useCallback(async (
    strokes: Stroke[],
    currentNote: NoteElements,
    setCurrentNote: (note: NoteElements) => void,
  ) => {
    if (strokes.length === 0 || interpretingRef.current) return;

    debugLog.info('Meme mode: processing strokes', { count: strokes.length });
    interpretingRef.current = true;
    setIsInterpreting(true);

    // First, add strokes as a temporary stroke element so they're visible
    const tempElement = createStrokeElement(strokes);
    const { dataUrl, bounds } = strokesToImage(strokes);

    // Create a placeholder meme element (shows "Generating...")
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

    // Replace strokes with placeholder
    setCurrentNote({
      ...currentNote,
      elements: [...currentNote.elements, placeholder],
    });

    try {
      if (!dataUrl) {
        throw new Error('Failed to capture strokes as image');
      }

      // Send to vision model
      const interpretation = await interpretSketch(dataUrl);
      debugLog.info('Meme interpretation result', interpretation);

      const finalWidth = interpretation.width || memeWidth;
      const finalHeight = interpretation.height || memeHeight;

      // Render the meme to a bitmap
      const bitmapDataUrl = renderMemeToBitmap(
        interpretation.category,
        interpretation.variant || '',
        interpretation.texts,
        finalWidth,
        finalHeight,
      );

      // Create final meme element
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

      // Replace placeholder with final meme, remove temp strokes
      setCurrentNote(prev => ({
        ...prev,
        elements: prev.elements
          .filter(el => el.id !== tempElement.id)
          .map(el => el.id === placeholder.id ? finalMeme : el),
      }));

    } catch (err) {
      debugLog.error('Meme interpretation failed', err);

      // On error, remove placeholder and keep original strokes
      setCurrentNote(prev => ({
        ...prev,
        elements: [
          ...prev.elements.filter(el => el.id !== placeholder.id),
          tempElement,
        ],
      }));
    } finally {
      interpretingRef.current = false;
      setIsInterpreting(false);
    }
  }, []);

  const interpretFullScene = useCallback(async (
    canvasRef: HTMLCanvasElement | null,
    currentNote: NoteElements,
    setCurrentNote: (note: NoteElements) => void,
  ) => {
    if (interpretingRef.current) return;

    const imageDataUrl = canvasToImage(canvasRef);
    if (!imageDataUrl) {
      debugLog.error('Failed to capture canvas for scene interpretation');
      return;
    }

    debugLog.info('Meme mode: interpreting full scene');
    interpretingRef.current = true;
    setIsInterpreting(true);

    // Create placeholder
    const placeholder = createMemeElement(50, 50, 'impact', [], 500, 500);
    placeholder.isGenerating = true;

    setCurrentNote({
      ...currentNote,
      elements: [...currentNote.elements, placeholder],
    });

    try {
      const interpretation = await interpretScene(imageDataUrl);
      debugLog.info('Scene interpretation result', interpretation);

      const finalWidth = interpretation.width || 500;
      const finalHeight = interpretation.height || 500;

      const bitmapDataUrl = renderMemeToBitmap(
        interpretation.category,
        interpretation.variant || '',
        interpretation.texts,
        finalWidth,
        finalHeight,
      );

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

      setCurrentNote(prev => ({
        ...prev,
        elements: prev.elements.map(el =>
          el.id === placeholder.id ? finalMeme : el
        ),
      }));

    } catch (err) {
      debugLog.error('Scene interpretation failed', err);
      setCurrentNote(prev => ({
        ...prev,
        elements: prev.elements.filter(el => el.id !== placeholder.id),
      }));
    } finally {
      interpretingRef.current = false;
      setIsInterpreting(false);
    }
  }, []);

  return {
    memeMode,
    setMemeMode,
    toggleMemeMode,
    processMemeModeStrokes,
    interpretFullScene,
    isInterpreting,
  };
}
