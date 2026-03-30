# Ink Playground

A React + TypeScript + Vite web application for interactive ink-based prototyping. Draw on an infinite canvas with a pointer device, and the app recognizes handwriting, detects shapes, and transforms your ink into interactive elements — text, geometric shapes, playable games, AI-generated images, and more.

Built with a plugin-based element architecture that makes adding new element types trivial.

## Features

**Core Canvas**
- Freehand ink drawing with pressure sensitivity
- Pan and zoom (trackpad/mouse wheel) with infinite canvas
- Undo/redo (Cmd+Z / Cmd+Shift+Z) with 100-step history
- Auto-save to localStorage

**Handwriting Recognition**
- Real-time handwriting recognition via external REST API
- Spatial and temporal stroke clustering for accurate grouping
- Multi-line text with token-level editing and erasure

**Shape Recognition**
- Automatic detection of circles, rectangles, triangles, lines, and polygons
- Beautification with smooth Bezier curves
- Animated morph from raw strokes to recognized shapes

**Interactive Games (via palette menu or ink detection)**
- TicTacToe, Sudoku, Minesweeper, N-Queens
- Bridges (Hashiwokakero), Nonogram, Jigsaw, Color Connect, Tango

**AI-Powered Elements**
- Sketch-to-image generation (fal.ai / Google Gemini)
- AI meme generation from drawings (OpenRouter LLM)
- Iterative refinement via additional ink input

**Gestures**
- Scribble eraser with intelligent stroke/token-level deletion
- Lasso selection for bulk operations (move, delete, meme-ify)
- Rectangle+X gesture opens a palette menu for game/element creation

**Other**
- 2D coordinate plane with draggable points and axis labels
- Image element with resize handles
- Disambiguation menu when multiple recognitions match
- Debug console overlay (press `D`)

## Tech Stack

| Technology | Purpose |
|------------|---------|
| React 19 | UI framework |
| TypeScript 5.9 (strict) | Type safety |
| Vite 7 | Build tool, dev server, HMR |
| Canvas 2D API | Rendering |
| OpenRouter SDK | LLM inference (memes) |
| concaveman | Concave hull computation (eraser) |
| fal.ai / Gemini APIs | AI image generation |

## Getting Started

### Prerequisites

- Node.js v18+
- npm
- A running handwriting recognition API endpoint

### Installation

```bash
git clone <repo-url>
cd ink-ai-hack-playground
npm install
```

### Environment Setup

```bash
cp .env.example .env
```

Configure the following in `.env`:

| Variable | Required | Description |
|----------|----------|-------------|
| `INK_RECOGNITION_API_URL` | Yes | Handwriting recognition API endpoint |
| `INK_OPENROUTER_API_KEY` | No | OpenRouter API key for meme generation ([get one](https://openrouter.ai/keys)) |
| `INK_FAL_AI_API_KEY` | No | fal.ai API key for sketch-to-image ([get one](https://fal.ai/dashboard/keys)) |
| `INK_GEMINI_API_KEY` | No | Google Gemini API key for image generation ([get one](https://aistudio.google.com/apikey)) |

### Running

```bash
npm run dev       # Dev server with HMR at http://localhost:5173
npm run build     # Production build (TypeScript compile + Vite bundle)
npm run lint      # ESLint check
npm run preview   # Preview production build
```

The dev server exposes on all network interfaces (`--host`), so other devices on the same network can access it.

## How It Works

1. **Draw** on the canvas with a stylus, mouse, or finger
2. **Strokes are buffered** and debounced (650ms window)
3. **Clustering** groups nearby strokes spatially and temporally
4. **Recognition** sends clusters to the handwriting API
5. **Element creation** — plugins compete to interpret the strokes (shape detector, text recognizer, game grid detector, etc.)
6. **Disambiguation** — if multiple plugins match, a menu lets you pick
7. **Interaction** — draw on existing elements to interact (tap a TicTacToe cell, edit text tokens, refine an AI image)

## Element Types

| Element | Description | How to Create |
|---------|-------------|---------------|
| Stroke | Raw ink | Draw anything |
| Shape | Circle, rectangle, triangle, polygon, line | Draw a geometric shape |
| InkText | Recognized handwriting | Write text |
| TicTacToe | Playable 3x3 game | Draw a grid, or use palette |
| Sudoku | 9x9 puzzle | Palette menu |
| Minesweeper | Classic mine game | Palette menu |
| N-Queens | Queen placement puzzle | Palette menu |
| Bridges | Hashiwokakero puzzle | Palette menu |
| Nonogram | Pixel art puzzle | Palette menu (uses image context) |
| Jigsaw | Image jigsaw puzzle | Palette menu (uses image context) |
| Color Connect | Path-drawing puzzle | Palette menu |
| Tango | Latin square variant | Palette menu |
| Image | Bitmap with resize handles | Palette menu |
| Sketchable Image | AI-generated from sketch | Palette menu, then draw |
| Coordinate Plane | 2D grid with draggable points | Draw axes/grid |
| Meme | AI-interpreted meme | Lasso selection in meme mode |

**Palette menu:** Draw a rectangle, then draw an X through it.

## Project Structure

```
src/
  App.tsx                  # Main app — state, stroke lifecycle, keyboard shortcuts
  canvas/                  # Canvas rendering, viewport, stroke drawing
  input/                   # Pointer event accumulation (StrokeBuilder)
  recognition/             # Handwriting recognition client + stroke clustering
  elements/                # Plugin-based element system
    registry/              #   Plugin interface + registry dispatcher
    stroke/                #   Raw ink strokes
    shape/                 #   Geometric shapes
    inktext/               #   Recognized text
    tictactoe/             #   TicTacToe game
    sudoku/                #   Sudoku puzzle
    minesweeper/           #   Minesweeper game
    queens/                #   N-Queens puzzle
    bridges/               #   Bridges puzzle
    nonogram/              #   Nonogram puzzle
    jigsaw/                #   Jigsaw puzzle
    colorconnect/          #   Color Connect puzzle
    tango/                 #   Tango puzzle
    image/                 #   Bitmap image
    sketchableimage/       #   AI sketch-to-image
    coordinateplane/       #   2D coordinate system
    meme/                  #   AI meme generation
  eraser/                  # Scribble detection + element deletion
  geometry/                # Shape recognition, corner detection, hull computation
  lasso/                   # Lasso selection + containment tests
  palette/                 # Rectangle+X gesture menu system
  disambiguation/          # Multi-candidate selection menu
  state/                   # useUndoRedo hook
  hooks/                   # Feature-specific React hooks
  services/                # External API clients (fal.ai, Gemini)
  ai/                      # OpenRouter LLM client
  types/                   # Core type definitions (Stroke, Element, etc.)
  debug/                   # Debug logger + overlay console
  toast/                   # Toast notification system
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed design documentation and data flow diagrams.

## Adding New Element Types

The plugin architecture requires minimal boilerplate — create a directory in `src/elements/`, implement a renderer, and add one line to the type union. No changes to `App.tsx`, dispatch logic, or menus.

See [`docs/New element HOWTO.md`](docs/New%20element%20HOWTO.md) for a complete step-by-step guide.

## License

MIT
