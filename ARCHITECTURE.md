# Architecture

This document describes the architecture of Ink Playground — a canvas-based web app that captures ink input, recognizes handwriting and shapes, and renders interactive elements.

## High-Level Overview

```
                         ┌─────────────────────────────────────────────────┐
                         │                   Browser                       │
                         │                                                 │
  Pointer Events ───────>│  ┌──────────┐    ┌──────────┐    ┌──────────┐  │
  (stylus/mouse/touch)   │  │  Stroke   │───>│ Debounce │───>│ Cluster  │  │
                         │  │  Builder  │    │ (650ms)  │    │ Strokes  │  │
                         │  └──────────┘    └──────────┘    └─────┬────┘  │
                         │       │                                │       │
                         │       v                                v       │
                         │  ┌──────────┐    ┌──────────┐    ┌──────────┐  │
                         │  │ Overlay  │    │ Recogni- │<──>│  REST    │  │
                         │  │ Canvas   │    │  tion    │    │  API     │  │
                         │  │(live ink)│    │ Service  │    │(external)│  │
                         │  └──────────┘    └─────┬────┘    └──────────┘  │
                         │                        │                       │
                         │                        v                       │
                         │              ┌─────────────────┐               │
                         │              │ Element Registry │               │
                         │              │  (plugin loop)   │               │
                         │              └────────┬────────┘               │
                         │                       │                        │
                         │          ┌────────────┼────────────┐           │
                         │          v            v            v           │
                         │     ┌────────┐  ┌─────────┐  ┌────────┐      │
                         │     │ Create │  │Interact │  │Disambig│      │
                         │     │Element │  │Existing │  │ Menu   │      │
                         │     └───┬────┘  └────┬────┘  └───┬────┘      │
                         │         └────────┬───┘           │           │
                         │                  v               │           │
                         │         ┌────────────────┐       │           │
                         │         │  noteElements  │<──────┘           │
                         │         │  (app state)   │                   │
                         │         └───────┬────────┘                   │
                         │                 │                            │
                         │                 v                            │
                         │         ┌──────────────┐                    │
                         │         │  Main Canvas  │                    │
                         │         │  (committed)  │                    │
                         │         └──────────────┘                    │
                         └─────────────────────────────────────────────┘
```

## Core Concepts

### Dual Canvas Rendering

Two `<canvas>` elements are layered on top of each other:

| Canvas | Purpose | Update Frequency |
|--------|---------|-----------------|
| **Main** | Renders committed elements from `noteElements` | On state change |
| **Overlay** | Renders in-progress strokes, selection UI, handles | Every pointer move / animation frame |

This separation keeps the UI responsive — the overlay redraws at pointer-event frequency without re-rendering the full element tree.

**Main canvas rendering order:**
1. Apply viewport transform (pan + zoom)
2. Iterate `noteElements.elements` array
3. Dispatch each element to its plugin's `render()` via `ElementRenderer`
4. Pass `morphProgress` (0..1) for elements animating from source strokes to final form

**Overlay canvas rendering order:**
1. In-progress strokes (from `finishedStrokesRef`)
2. Active lasso polygon
3. Selection marquee
4. Element manipulation handles
5. Debug overlay (if enabled)

### Viewport

`ViewportManager` handles pan/zoom coordinate transforms:

```
Screen coordinates  ──screenToCanvas()──>  Canvas coordinates
                    <──canvasToScreen()──
```

- Pan: trackpad scroll / two-finger drag
- Zoom: Cmd+scroll / pinch, clamped to `[0.1, 10.0]`
- State persisted to `localStorage` across sessions

## Stroke Lifecycle

This is the central pipeline — from pointer event to rendered element.

```
 pointer-down
     │
     v
 StrokeBuilder.start(x, y, pressure)
     │
 pointer-move (repeated)
     │
     v
 StrokeBuilder.addPoint(x, y, pressure)
     │                                          ┌─────────────────┐
     │  (live rendering on overlay canvas) ────>│  Overlay Canvas  │
     │                                          └─────────────────┘
 pointer-up
     │
     v
 StrokeBuilder.finish() ──> Stroke object
     │
     ├──> finishedStrokesRef (overlay display)
     │
     ├──> strokeBufferRef (debounce accumulator)
     │
     v
 Debounce timer starts (650ms, reset on new stroke)
     │
     │  ... user stops drawing ...
     │
     v
 Buffer flushed ──> processStrokes()
     │
     v
 StrokeClustering.getMostRecentCluster()
     │  (groups strokes by spatial proximity + temporal adjacency)
     │
     v
 RecognitionService.recognizeGoogle()
     │  POST /api/recognition ──proxy──> external API
     │
     v
 Recognition result: { lines: [{ tokens: [{ text, candidates, strokeIndices }] }] }
     │
     ├──> tryInteraction() ──> loop elements, check isInterestedIn(), call acceptInk()
     │         │
     │         ├── consumed: element mutated, strokes removed from overlay
     │         └── not consumed: fall through
     │
     └──> tryCreateElementWithDisambiguation()
               │
               ├── single match (high confidence): element added to noteElements
               ├── multiple matches: DisambiguationMenu shown
               └── no match: strokes remain as StrokeElements
```

**Debounce timing:**
- Normal mode: 650ms
- Meme mode: 4000ms (lets user complete complex sketches)

**Eager interactions:** Some plugins (Sudoku, Minesweeper) set `triesEagerInteractions: true` — their interactions fire on pen-up, bypassing the debounce, for responsive tap-to-play.

## Element Plugin System

### Architecture

```
  src/elements/
  ├── registry/
  │   ├── ElementPlugin.ts      # Plugin interface definition
  │   └── ElementRegistry.ts    # Registry + dispatch functions
  │
  ├── index.ts                  # Imports all plugins (side-effect registration)
  │
  ├── stroke/                   # Example: render-only plugin
  │   ├── types.ts
  │   ├── renderer.ts
  │   └── index.ts              # registerPlugin(strokePlugin)
  │
  ├── shape/                    # Example: creation + rendering
  │   ├── types.ts
  │   ├── creator.ts
  │   ├── renderer.ts
  │   └── index.ts
  │
  ├── tictactoe/                # Example: creation + interaction + rendering
  │   ├── types.ts
  │   ├── creator.ts
  │   ├── interaction.ts
  │   ├── renderer.ts
  │   └── index.ts
  │
  └── image/                    # Example: handle-based manipulation
      ├── types.ts
      ├── renderer.ts
      └── index.ts              # getHandles() + onHandleDrag()
```

### Plugin Interface

Every plugin implements a subset of the `ElementPlugin<T>` interface:

```
ElementPlugin<T>
│
├── elementType: string             # Discriminator — must match element.type
├── name: string                    # Human-readable name
│
├── render(ctx, element, options)   # [required] Draw element to canvas
├── getBounds(element)              # [required] Return bounding box
│
├── canCreate(strokes)              # [optional] Quick check: can these strokes form this element?
├── createFromInk(strokes, ctx, recog)  # [optional] Async creation with recognition data
│
├── isInterestedIn(el, strokes, bounds) # [optional] Would this element like these strokes?
├── acceptInk(el, strokes, recog)       # [optional] Mutate element with new ink
├── triesEagerInteractions              # [optional] Fire on pen-up, skip debounce
│
├── getHandles(element)             # [optional] Return draggable handle descriptors
└── onHandleDrag(el, id, phase, pt) # [optional] Handle drag callback
```

### Plugin Tiers

| Tier | Capabilities | Examples |
|------|-------------|----------|
| **Render-only** | `render` + `getBounds` | Stroke, Glyph |
| **Creatable** | + `canCreate` + `createFromInk` | Shape, InkText, CoordinatePlane |
| **Interactive** | + `isInterestedIn` + `acceptInk` | TicTacToe, Sudoku, Minesweeper |
| **Handle-based** | + `getHandles` + `onHandleDrag` | Image (resize), CoordinatePlane (axis drag) |
| **Palette-registered** | + `registerPaletteEntry()` | Sudoku, Minesweeper, Image, SketchableImage |

### Dispatch Flow

**Element creation:**
```
processStrokes()
  └── tryCreateElementWithDisambiguation()
        └── ElementRegistry: for each plugin with canCreate()
              ├── plugin.canCreate(strokes)? ──no──> skip
              └── yes ──> plugin.createFromInk(strokes, context, recognition)
                            └── returns { elements, consumedStrokes, confidence }
        └── Sort results by confidence
        └── If 1 result or clear winner: auto-accept
        └── If close competitors: show DisambiguationMenu
```

**Element interaction:**
```
processStrokes()
  └── tryInteraction()
        └── for each element in noteElements:
              └── for each plugin:
                    ├── plugin.isInterestedIn(element, strokes, bounds)?
                    │     └── yes ──> plugin.acceptInk(element, strokes, recog)
                    │                   └── { element: mutated, consumed: true }
                    └── no ──> next element
```

**Element rendering:**
```
InkCanvas render loop (requestAnimationFrame)
  └── for each element in noteElements:
        └── ElementRenderer.renderElement(ctx, element, options)
              └── registry.getPlugin(element.type).render(ctx, element, options)
```

### Registration

Plugins self-register as a module side-effect:

```typescript
// src/elements/tictactoe/index.ts
const ticTacToePlugin: ElementPlugin<TicTacToeElement> = { ... };
registerPlugin(ticTacToePlugin);
```

`src/elements/index.ts` imports every plugin directory, ensuring all plugins are registered before the app renders:

```typescript
import './stroke';
import './shape';
import './inktext';
import './tictactoe';
// ... all others
```

## Gesture Recognition

### Scribble Eraser

Detects scribble gestures and erases overlapping elements.

```
Stroke ──> scribbleDetection.ts ──> weighted scoring (6 factors)
                                         │
                   ┌─────────────────────┤
                   │                     │
           Hard requirements:      Soft scoring:
           - min bbox 40px         - direction changes (45deg)
           - min 3 reversals       - curvature (Bezier)
           - min path 100px        - bbox compactness
                                   - stroke density
                                   - self-intersections
                                   - direction reversals (>90deg)
                                         │
                                    Score >= threshold?
                                         │
                               yes ──> computeConcaveHull()
                                         │
                                    For each element:
                                    overlap >= 50%? ──> delete
```

Special cases:
- **InkText**: token-level erasure (partial deletion)
- **CoordinatePlane**: point-level + ink erasure, full delete at >67% area coverage
- **All others**: full element deletion on overlap

### Lasso Selection

```
Draw open/closed polygon ──> lassoDetection.ts
                                  │
                             Build polygon hull
                                  │
                             Test each element's bounds
                             for containment/overlap
                                  │
                             Show LassoMenu:
                               - Select elements
                               - Delete elements
                               - Generate meme (meme mode)
```

### Rectangle+X Palette Menu

```
Draw rectangle ──> Draw X through it ──> rectangleXDetection.ts
                                              │
                                         Detect corner pattern
                                              │
                                         Show PaletteMenu.tsx
                                              │
                                    ┌─────────┼─────────────┐
                                    v         v             v
                               Games     Images        Elements
                              (Sudoku,  (Image,       (generated
                             Minesweep  Sketch,       from palette
                              Queens,   Nonogram...)   entries)
                             Bridges...)
```

Palette entries are registered by plugins via `registerPaletteEntry()`.

## State Management

### App State

```
App.tsx
  │
  ├── useUndoRedo<NoteElements>(loadSavedNote())
  │     │
  │     ├── current: NoteElements    # Source of truth for all elements
  │     ├── undoStack: NoteElements[] # Max 100 entries
  │     ├── redoStack: NoteElements[]
  │     ├── set(updater)             # Push to undo, clear redo
  │     ├── undo()                   # Pop undo, push to redo
  │     └── redo()                   # Pop redo, push to undo
  │
  ├── Refs (mutable, not triggering re-renders)
  │     ├── finishedStrokesRef       # Strokes displayed on overlay
  │     ├── strokeBufferRef          # Debounce accumulator
  │     ├── debounceTimeoutRef       # Debounce timer
  │     └── pendingStrokesRef        # Strokes awaiting recognition
  │
  ├── Local state
  │     ├── viewport (pan, zoom)
  │     ├── tool (pen / eraser / select)
  │     ├── brush (color, size, type)
  │     ├── selection state
  │     └── intent states (lasso, palette, disambiguation)
  │
  └── Derived state (useMemo)
        ├── selectedElements
        ├── brushColorFromSelection
        └── animatingElements
```

### Persistence

| Data | Storage | Trigger |
|------|---------|---------|
| `noteElements` | `localStorage['ink-playground-note']` | Debounced (1000ms) on change |
| Viewport (pan, zoom) | `localStorage['ink-playground-viewport']` | On viewport change |

### Immutability

All state updates produce new objects via spread operators. This enables:
- Reliable undo/redo (snapshot-based)
- React re-render detection
- No stale closure bugs in event handlers

## Recognition Service

```
Client (browser)                          External API
     │                                         │
     │  POST /api/recognition/recognize_google │
     │  {                                      │
     │    strokes: [{ x[], y[], t[] }],        │
     │    writingAreaWidth,                     │
     │    writingAreaHeight,                    │
     │    preContext                            │
     │  }                                      │
     │ ──────────────────────────────────────> │
     │                                         │
     │  {                                      │
     │    lines: [{                            │
     │      tokens: [{                         │
     │        text,                            │
     │        candidates: [{ text, score }],   │
     │        strokeIndices: [0, 1, ...],      │
     │        boundingBox                      │
     │      }]                                 │
     │    }],                                  │
     │    rawText                              │
     │  }                                      │
     │ <────────────────────────────────────── │
```

In development, Vite proxies `/api/recognition` to the configured `INK_RECOGNITION_API_URL`, avoiding CORS issues.

### Stroke Clustering

Before recognition, strokes are grouped by `StrokeClustering`:

- **Spatial proximity**: strokes within 120px of each other
- **Temporal adjacency**: strokes within 5000ms of each other
- Returns the most recent cluster for recognition

## External Services

```
                          ┌──────────────────────┐
                          │    Ink Playground     │
                          └──────┬───────────────┘
                                 │
             ┌───────────────────┼───────────────────┐
             │                   │                   │
             v                   v                   v
    ┌────────────────┐  ┌────────────────┐  ┌────────────────┐
    │  Recognition   │  │   OpenRouter   │  │  Image Gen     │
    │  API           │  │   (LLM)       │  │  (fal.ai /     │
    │                │  │               │  │   Gemini)       │
    │  Handwriting   │  │  Meme text    │  │                │
    │  recognition   │  │  generation   │  │  Sketch-to-    │
    │  + candidates  │  │  + interpret  │  │  image         │
    └────────────────┘  └────────────────┘  └────────────────┘
         required            optional             optional
```

| Service | Client | Purpose |
|---------|--------|---------|
| Recognition API | `RecognitionService.ts` | Handwriting recognition (required) |
| OpenRouter | `OpenRouterService.ts` | LLM inference for meme interpretation |
| fal.ai | `FalAiService.ts` | Sketch-to-image generation |
| Google Gemini | `GeminiImageService.ts` | Alternative image generation |

## Type System

### Core Types

```
Stroke
├── id: string
├── inputs: StrokeInput[]      # Points with x, y, pressure, timestamp
└── brush: Brush               # color (ARGB int), size, stockBrush

Element (discriminated union)
├── StrokeElement               # Raw ink (no transform)
├── ShapeElement                # Geometric shape with Bezier paths
├── InkTextElement              # Recognized multi-line text
├── TicTacToeElement            # Game state + grid
├── SudokuElement               # Puzzle state
├── MinesweeperElement          # Game state
├── QueensElement               # Puzzle state
├── BridgesElement              # Puzzle state
├── NonogramElement             # Puzzle state
├── JigsawElement               # Puzzle state
├── ColorConnectElement         # Puzzle state
├── TangoElement                # Puzzle state
├── ImageElement                # Bitmap + source URL
├── SketchableImageElement      # AI-generated image + prompt
├── CoordinatePlaneElement      # Axes + points + annotations
├── MemeElement                 # Template + generated text
└── GlyphElement                # Single rendered character

TransformableElement
├── id: string
├── type: string
└── transform: Matrix           # 3x3 affine: [a, b, c, d, e, f, tx, ty, 1]

NoteElements
└── elements: Element[]         # Ordered list (rendering order)
```

### Adding a New Element Type

1. Create `src/elements/<type>/types.ts` — define the interface extending `TransformableElement`
2. Create `src/elements/<type>/renderer.ts` — implement `render()` and `getBounds()`
3. Create `src/elements/<type>/index.ts` — wire plugin and call `registerPlugin()`
4. Edit `src/types/elements.ts` — add to `Element` union (1 line)
5. Edit `src/elements/index.ts` — add `import './<type>'` (1 line)

No changes to App.tsx, ElementRenderer, PaletteMenu, or dispatch logic.

See [`docs/New element HOWTO.md`](docs/New%20element%20HOWTO.md) for the full guide.

## Canvas Rendering Pipeline

```
requestAnimationFrame loop
│
├── Clear both canvases
│
├── Main Canvas
│   ├── ctx.save()
│   ├── Apply viewport transform (translate + scale)
│   ├── For each element in noteElements.elements:
│   │   └── ElementRenderer.renderElement(ctx, element, { morphProgress })
│   │       └── Plugin.render(ctx, element, options)
│   └── ctx.restore()
│
└── Overlay Canvas
    ├── Render finishedStrokesRef (in-progress strokes)
    │   └── StrokeRenderer.renderStroke(ctx, stroke)
    │       ├── Ballpoint: standard line rendering
    │       ├── Highlighter: multiply composite mode
    │       └── Pencil: reduced width (0.8x)
    ├── Render lasso polygon (if active)
    ├── Render selection marquee (if active)
    ├── Render element handles (if selection active)
    │   └── HandleRenderer.renderHandles(ctx, handles)
    └── Render debug overlay (if enabled)
```

### Stroke Rendering

`StrokeRenderer` supports variable-width rendering using pressure data:

- Each `StrokeInput` carries `pressure` (0..1)
- Width interpolated between segments: `baseWidth * pressure`
- Anti-aliasing via `lineCap: 'round'`, `lineJoin: 'round'`
- Brush-specific compositing (highlighter uses `multiply` blend mode)

### Shape Animation

When a shape is recognized, it morphs from raw strokes to the final form:

```
morphProgress: 0.0 ──────────────> 1.0
  (source strokes)                (final shape)
```

The plugin's `render()` receives `morphProgress` in `RenderOptions` and interpolates between the raw stroke positions and the beautified Bezier paths.

## Debug System

```
DebugLogger (singleton)
├── log(level, message, data)     # Levels: info, warn, error, action
├── logElementCreated(type, id)   # Structured action log
├── logInteraction(type, id)
├── subscribe(listener)           # Observer pattern
└── messages: LogEntry[]          # Ring buffer, max 500

DebugConsole (React component)
├── Subscribes to DebugLogger
├── Toggle with 'D' key
├── Filter by level
└── Shows timestamp + level + message + data payload
```

## Key Design Decisions

**Plugin architecture over switch statements.** Element types self-register; the registry dispatches polymorphically. Adding an element type is a local change — no shotgun surgery across the codebase.

**Dual canvas for responsiveness.** Separating live ink (overlay) from committed elements (main) avoids redrawing the entire element tree on every pointer move.

**Debounce before recognition.** The 650ms window batches rapid strokes into a single recognition call, reducing API traffic and improving grouping accuracy.

**Immutable state updates.** All mutations produce new objects, enabling snapshot-based undo/redo without deep cloning.

**Concave hull for eraser.** Using `concaveman` to compute the eraser's deletion boundary handles irregular scribble shapes better than bounding-box or convex-hull approaches.

**Eager interactions for games.** Tap-based games (Sudoku, Minesweeper) bypass the debounce for immediate response, while drawing-based elements wait for the full stroke cluster.

**Stroke clustering before recognition.** Grouping strokes spatially and temporally before sending to the API produces better recognition results than sending individual strokes.
