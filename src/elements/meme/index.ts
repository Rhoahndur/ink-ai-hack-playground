// Meme Element Plugin
//
// AI-interpreted memes from hand-drawn sketches. Created via meme mode toggle
// or palette menu (rectangle+X gesture). Importing this module auto-registers.

import type { MemeElement } from './types';
import type { ElementPlugin } from '../registry/ElementPlugin';
import { registerPlugin } from '../registry/ElementRegistry';
import { render, getBounds } from './renderer';
import { registerPaletteEntry } from '../../palette/PaletteRegistry';
import { MemeIcon } from './icon';
import { createMemeElement } from './types';

const memePlugin: ElementPlugin<MemeElement> = {
  elementType: 'meme',
  name: 'Meme',

  // No canCreate/createFromInk — meme creation is handled by the meme mode
  // pipeline in App.tsx, not the normal element creation dispatch.

  render,
  getBounds,
};

registerPlugin(memePlugin);

// Palette entry: rectangle+X gesture → "Meme" option
registerPaletteEntry({
  id: 'meme',
  label: 'Meme',
  Icon: MemeIcon,
  category: 'content',
  onSelect: async (bounds, consumeStrokes) => {
    const rectWidth = bounds.right - bounds.left;
    const rectHeight = bounds.bottom - bounds.top;
    const size = Math.max(rectWidth, rectHeight, 400);

    const element = createMemeElement(
      bounds.left,
      bounds.top,
      'impact',
      [
        { text: 'YOUR MEME', position: 'top' },
        { text: 'GOES HERE', position: 'bottom' },
      ],
      size,
      size,
    );
    consumeStrokes();
    return { ...element, isGenerating: true };
  },
});

export { memePlugin };
