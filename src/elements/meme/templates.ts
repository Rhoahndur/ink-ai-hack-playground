// Meme template rendering — draws meme characters and layouts on canvas.
// Simplified but recognizable versions of classic meme characters.

import type { MemeCategory, MemeText } from './types';

// ============================================================================
// Text rendering (Impact font style)
// ============================================================================

function drawMemeText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  fontSize: number,
  align: CanvasTextAlign = 'center',
) {
  ctx.save();
  ctx.font = `bold ${fontSize}px Impact, Arial Black, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'top';

  // Word wrap
  const lines = wrapText(ctx, text.toUpperCase(), maxWidth - 20);

  for (let i = 0; i < lines.length; i++) {
    const ly = y + i * (fontSize + 4);
    // Black outline
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = fontSize / 8;
    ctx.lineJoin = 'round';
    ctx.strokeText(lines[i], x, ly);
    // White fill
    ctx.fillStyle = '#ffffff';
    ctx.fillText(lines[i], x, ly);
  }
  ctx.restore();
  return lines.length * (fontSize + 4);
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines.length > 0 ? lines : [''];
}

// ============================================================================
// Pepe/Apu drawing
// ============================================================================

function drawPepe(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  variant: string,
) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const r = Math.min(w, h) * 0.4;

  // Face (green)
  ctx.save();
  ctx.fillStyle = '#6B8E23';
  ctx.beginPath();
  ctx.ellipse(cx, cy, r, r * 0.85, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#3d5213';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Eyes
  const eyeY = cy - r * 0.15;
  const eyeSpacing = r * 0.35;
  const eyeR = r * 0.22;

  // White of eyes (bulging out of head)
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(cx - eyeSpacing, eyeY - r * 0.1, eyeR * 1.3, eyeR * 1.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#3d5213';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(cx + eyeSpacing, eyeY - r * 0.1, eyeR * 1.3, eyeR * 1.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Pupils - vary by variant
  ctx.fillStyle = '#000000';
  const pupilR = eyeR * 0.5;
  let pupilOffsetX = 0;
  let pupilOffsetY = 0;

  if (variant === 'smug') {
    pupilOffsetX = pupilR * 0.3;
    pupilOffsetY = pupilR * 0.3;
  } else if (variant === 'thinking') {
    pupilOffsetX = pupilR * 0.5;
    pupilOffsetY = -pupilR * 0.3;
  }

  ctx.beginPath();
  ctx.arc(cx - eyeSpacing + pupilOffsetX, eyeY - r * 0.1 + pupilOffsetY, pupilR, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + eyeSpacing + pupilOffsetX, eyeY - r * 0.1 + pupilOffsetY, pupilR, 0, Math.PI * 2);
  ctx.fill();

  // Mouth - varies by variant
  const mouthY = cy + r * 0.3;
  ctx.strokeStyle = '#3d5213';
  ctx.lineWidth = 2.5;
  ctx.beginPath();

  switch (variant) {
    case 'smug':
      // Smug smirk
      ctx.moveTo(cx - r * 0.3, mouthY);
      ctx.quadraticCurveTo(cx, mouthY - r * 0.15, cx + r * 0.4, mouthY - r * 0.1);
      ctx.stroke();
      break;
    case 'sad':
      // Sad frown
      ctx.moveTo(cx - r * 0.3, mouthY + r * 0.1);
      ctx.quadraticCurveTo(cx, mouthY - r * 0.15, cx + r * 0.3, mouthY + r * 0.1);
      ctx.stroke();
      // Tears
      ctx.fillStyle = '#4444ff88';
      ctx.beginPath();
      ctx.ellipse(cx - eyeSpacing, eyeY + r * 0.15, pupilR * 0.6, pupilR * 1.5, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'angry':
      // Angry grimace
      ctx.moveTo(cx - r * 0.3, mouthY);
      ctx.lineTo(cx - r * 0.1, mouthY + r * 0.08);
      ctx.lineTo(cx + r * 0.1, mouthY - r * 0.05);
      ctx.lineTo(cx + r * 0.3, mouthY + r * 0.05);
      ctx.stroke();
      // Angry eyebrows
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx - eyeSpacing - eyeR, eyeY - r * 0.3);
      ctx.lineTo(cx - eyeSpacing + eyeR, eyeY - r * 0.18);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + eyeSpacing + eyeR, eyeY - r * 0.3);
      ctx.lineTo(cx + eyeSpacing - eyeR, eyeY - r * 0.18);
      ctx.stroke();
      break;
    case 'thinking':
      // Thinking — hand on chin
      ctx.moveTo(cx - r * 0.15, mouthY);
      ctx.quadraticCurveTo(cx + r * 0.1, mouthY + r * 0.1, cx + r * 0.25, mouthY);
      ctx.stroke();
      // Hand/chin touch
      ctx.fillStyle = '#6B8E23';
      ctx.beginPath();
      ctx.arc(cx + r * 0.5, mouthY + r * 0.15, r * 0.12, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#3d5213';
      ctx.stroke();
      break;
    case 'comfy':
      // Content smile + blush
      ctx.moveTo(cx - r * 0.25, mouthY - r * 0.05);
      ctx.quadraticCurveTo(cx, mouthY + r * 0.2, cx + r * 0.25, mouthY - r * 0.05);
      ctx.stroke();
      // Closed happy eyes
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - eyeSpacing - eyeR * 0.6, eyeY - r * 0.05);
      ctx.quadraticCurveTo(cx - eyeSpacing, eyeY - r * 0.15, cx - eyeSpacing + eyeR * 0.6, eyeY - r * 0.05);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + eyeSpacing - eyeR * 0.6, eyeY - r * 0.05);
      ctx.quadraticCurveTo(cx + eyeSpacing, eyeY - r * 0.15, cx + eyeSpacing + eyeR * 0.6, eyeY - r * 0.05);
      ctx.stroke();
      // Blush
      ctx.fillStyle = '#ff634788';
      ctx.beginPath();
      ctx.ellipse(cx - r * 0.45, mouthY - r * 0.05, r * 0.1, r * 0.06, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + r * 0.45, mouthY - r * 0.05, r * 0.1, r * 0.06, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    default: // happy
      ctx.moveTo(cx - r * 0.3, mouthY);
      ctx.quadraticCurveTo(cx, mouthY + r * 0.25, cx + r * 0.3, mouthY);
      ctx.stroke();
  }

  ctx.restore();
}

// ============================================================================
// Wojak drawing
// ============================================================================

function drawWojak(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  variant: string,
) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const r = Math.min(w, h) * 0.4;

  ctx.save();

  // Face shape
  ctx.fillStyle = variant === 'chad' ? '#f5d6a8' : '#ffeedd';
  ctx.beginPath();
  ctx.ellipse(cx, cy, r * 0.85, r, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#333333';
  ctx.lineWidth = 2;
  ctx.stroke();

  const eyeY = cy - r * 0.2;
  const eyeSpacing = r * 0.3;

  switch (variant) {
    case 'chad': {
      // Chad — strong jawline, confident eyes
      // Jaw
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.7, cy);
      ctx.lineTo(cx - r * 0.3, cy + r * 0.7);
      ctx.lineTo(cx + r * 0.3, cy + r * 0.7);
      ctx.lineTo(cx + r * 0.7, cy);
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2;
      ctx.stroke();
      // Eyes — small, confident
      ctx.fillStyle = '#333';
      ctx.fillRect(cx - eyeSpacing - 4, eyeY - 2, 8, 4);
      ctx.fillRect(cx + eyeSpacing - 4, eyeY - 2, 8, 4);
      // Smirk
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.2, cy + r * 0.25);
      ctx.lineTo(cx + r * 0.3, cy + r * 0.2);
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2;
      ctx.stroke();
      // Beard stubble dots (deterministic positions)
      const stubbleOffsets = [
        [-0.2, 0.38], [0.1, 0.42], [-0.05, 0.48], [0.2, 0.36],
        [-0.15, 0.52], [0.05, 0.55], [0.15, 0.45], [-0.1, 0.44],
      ];
      for (const [ox, oy] of stubbleOffsets) {
        ctx.fillStyle = '#999';
        ctx.beginPath();
        ctx.arc(cx + ox * r, cy + oy * r, 1, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'doomer': {
      // Doomer — dark circles, beanie
      // Beanie
      ctx.fillStyle = '#222';
      ctx.beginPath();
      ctx.ellipse(cx, cy - r * 0.6, r * 0.9, r * 0.4, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(cx - r * 0.9, cy - r * 0.6, r * 1.8, r * 0.15);
      // Dark circles under eyes
      ctx.fillStyle = '#44444466';
      ctx.beginPath();
      ctx.ellipse(cx - eyeSpacing, eyeY + r * 0.08, r * 0.15, r * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + eyeSpacing, eyeY + r * 0.08, r * 0.15, r * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();
      // Small tired eyes
      ctx.fillStyle = '#333';
      ctx.beginPath();
      ctx.arc(cx - eyeSpacing, eyeY, r * 0.05, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + eyeSpacing, eyeY, r * 0.05, 0, Math.PI * 2);
      ctx.fill();
      // Flat mouth
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.15, cy + r * 0.3);
      ctx.lineTo(cx + r * 0.15, cy + r * 0.3);
      ctx.stroke();
      break;
    }
    case 'soyjak': {
      // Soyjak — wide open mouth, glasses
      // Glasses
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx - eyeSpacing, eyeY, r * 0.18, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx + eyeSpacing, eyeY, r * 0.18, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - eyeSpacing + r * 0.18, eyeY);
      ctx.lineTo(cx + eyeSpacing - r * 0.18, eyeY);
      ctx.stroke();
      // Tiny pupils
      ctx.fillStyle = '#333';
      ctx.beginPath();
      ctx.arc(cx - eyeSpacing, eyeY, r * 0.04, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + eyeSpacing, eyeY, r * 0.04, 0, Math.PI * 2);
      ctx.fill();
      // Wide open mouth
      ctx.fillStyle = '#222';
      ctx.beginPath();
      ctx.ellipse(cx, cy + r * 0.35, r * 0.25, r * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'crying': {
      // Crying wojak
      // Scrunched eyes
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - eyeSpacing - r * 0.1, eyeY - r * 0.05);
      ctx.lineTo(cx - eyeSpacing + r * 0.1, eyeY + r * 0.05);
      ctx.moveTo(cx - eyeSpacing - r * 0.1, eyeY + r * 0.05);
      ctx.lineTo(cx - eyeSpacing + r * 0.1, eyeY - r * 0.05);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + eyeSpacing - r * 0.1, eyeY - r * 0.05);
      ctx.lineTo(cx + eyeSpacing + r * 0.1, eyeY + r * 0.05);
      ctx.moveTo(cx + eyeSpacing - r * 0.1, eyeY + r * 0.05);
      ctx.lineTo(cx + eyeSpacing + r * 0.1, eyeY - r * 0.05);
      ctx.stroke();
      // Tears
      ctx.fillStyle = '#4488ff88';
      ctx.beginPath();
      ctx.moveTo(cx - eyeSpacing, eyeY + r * 0.1);
      ctx.lineTo(cx - eyeSpacing - r * 0.08, eyeY + r * 0.4);
      ctx.lineTo(cx - eyeSpacing + r * 0.08, eyeY + r * 0.4);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx + eyeSpacing, eyeY + r * 0.1);
      ctx.lineTo(cx + eyeSpacing - r * 0.08, eyeY + r * 0.4);
      ctx.lineTo(cx + eyeSpacing + r * 0.08, eyeY + r * 0.4);
      ctx.fill();
      // Wobbly mouth
      ctx.strokeStyle = '#333';
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.2, cy + r * 0.35);
      ctx.quadraticCurveTo(cx - r * 0.1, cy + r * 0.28, cx, cy + r * 0.35);
      ctx.quadraticCurveTo(cx + r * 0.1, cy + r * 0.42, cx + r * 0.2, cy + r * 0.35);
      ctx.stroke();
      break;
    }
    default: { // bloomer
      // Bloomer — happy, flower
      ctx.fillStyle = '#333';
      ctx.beginPath();
      ctx.arc(cx - eyeSpacing, eyeY, r * 0.06, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + eyeSpacing, eyeY, r * 0.06, 0, Math.PI * 2);
      ctx.fill();
      // Smile
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.2, cy + r * 0.2);
      ctx.quadraticCurveTo(cx, cy + r * 0.4, cx + r * 0.2, cy + r * 0.2);
      ctx.stroke();
      // Flower on shirt area
      ctx.fillStyle = '#ff6347';
      for (let a = 0; a < 5; a++) {
        const angle = (a / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(
          cx + Math.cos(angle) * r * 0.12,
          cy + r * 0.7 + Math.sin(angle) * r * 0.12,
          r * 0.06, 0, Math.PI * 2
        );
        ctx.fill();
      }
      ctx.fillStyle = '#ffff00';
      ctx.beginPath();
      ctx.arc(cx, cy + r * 0.7, r * 0.05, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

// ============================================================================
// Layout renderers for each meme category
// ============================================================================

export function renderMemeToCanvas(
  ctx: CanvasRenderingContext2D,
  category: MemeCategory,
  variant: string,
  texts: MemeText[],
  width: number,
  height: number,
) {
  ctx.save();

  switch (category) {
    case 'pepe':
      renderCharacterMeme(ctx, drawPepe, variant || 'happy', texts, width, height, '#f0f0f0');
      break;
    case 'wojak':
      renderCharacterMeme(ctx, drawWojak, variant || 'bloomer', texts, width, height, '#f5f5f5');
      break;
    case 'drake':
      renderDrakeMeme(ctx, texts, width, height);
      break;
    case 'brain':
      renderBrainMeme(ctx, texts, width, height);
      break;
    case 'impact':
    default:
      renderImpactMeme(ctx, texts, width, height);
      break;
  }

  ctx.restore();
}

function renderCharacterMeme(
  ctx: CanvasRenderingContext2D,
  drawCharacter: (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, variant: string) => void,
  variant: string,
  texts: MemeText[],
  w: number, h: number,
  bgColor: string,
) {
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#cccccc';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, w, h);

  const charHeight = h * 0.6;
  const charY = (h - charHeight) / 2;
  drawCharacter(ctx, 0, charY, w, charHeight, variant);

  const topText = texts.find(t => t.position === 'top');
  if (topText) {
    const fontSize = Math.max(20, Math.min(36, w / 12));
    drawMemeText(ctx, topText.text, w / 2, 8, w, fontSize);
  }

  const bottomText = texts.find(t => t.position === 'bottom');
  if (bottomText) {
    const fontSize = Math.max(20, Math.min(36, w / 12));
    drawMemeText(ctx, bottomText.text, w / 2, h - fontSize - 12, w, fontSize);
  }
}

function renderDrakeMeme(
  ctx: CanvasRenderingContext2D,
  texts: MemeText[],
  w: number, h: number,
) {
  const panelH = h / 2;

  // Top panel — reject (red tinted)
  ctx.fillStyle = '#ffdddd';
  ctx.fillRect(0, 0, w, panelH);
  ctx.strokeStyle = '#cc0000';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, w, panelH);

  // Disapproval face (simplified)
  const faceW = w * 0.35;
  ctx.save();
  ctx.fillStyle = '#f5d6a8';
  ctx.beginPath();
  ctx.arc(faceW / 2, panelH / 2, faceW * 0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2;
  ctx.stroke();
  // X eyes
  const ex = faceW / 2;
  const ey = panelH / 2 - faceW * 0.08;
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#cc0000';
  ctx.beginPath();
  ctx.moveTo(ex - 12, ey - 5); ctx.lineTo(ex - 4, ey + 3);
  ctx.moveTo(ex - 4, ey - 5); ctx.lineTo(ex - 12, ey + 3);
  ctx.moveTo(ex + 4, ey - 5); ctx.lineTo(ex + 12, ey + 3);
  ctx.moveTo(ex + 4, ey - 5); ctx.lineTo(ex + 12, ey + 3);
  ctx.stroke();
  // Frown
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(ex - 10, panelH / 2 + faceW * 0.15);
  ctx.quadraticCurveTo(ex, panelH / 2 + faceW * 0.05, ex + 10, panelH / 2 + faceW * 0.15);
  ctx.stroke();
  // Hand gesture (waving away)
  ctx.strokeStyle = '#f5d6a8';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(faceW * 0.7, panelH * 0.3);
  ctx.lineTo(faceW * 0.85, panelH * 0.15);
  ctx.stroke();
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  // Bottom panel — approve (green tinted)
  ctx.fillStyle = '#ddffdd';
  ctx.fillRect(0, panelH, w, panelH);
  ctx.strokeStyle = '#008800';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, panelH, w, panelH);

  // Approval face
  ctx.save();
  ctx.fillStyle = '#f5d6a8';
  ctx.beginPath();
  ctx.arc(faceW / 2, panelH + panelH / 2, faceW * 0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Happy eyes
  ctx.fillStyle = '#333';
  ctx.beginPath();
  ctx.arc(faceW / 2 - 8, panelH + panelH / 2 - faceW * 0.08, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(faceW / 2 + 8, panelH + panelH / 2 - faceW * 0.08, 3, 0, Math.PI * 2);
  ctx.fill();
  // Smile
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2;
  ctx.beginPath();
  const sy = panelH + panelH / 2 + faceW * 0.1;
  ctx.moveTo(faceW / 2 - 10, sy);
  ctx.quadraticCurveTo(faceW / 2, sy + 10, faceW / 2 + 10, sy);
  ctx.stroke();
  // Pointing finger
  ctx.strokeStyle = '#f5d6a8';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(faceW * 0.7, panelH + panelH * 0.5);
  ctx.lineTo(faceW * 0.95, panelH + panelH * 0.4);
  ctx.stroke();
  ctx.restore();

  // Text in right side of panels
  const textX = w * 0.35 + (w * 0.65) / 2;
  const fontSize = Math.max(18, Math.min(28, w / 16));
  const topText = texts.find(t => t.position === 'top');
  const bottomText = texts.find(t => t.position === 'bottom');

  if (topText) {
    drawMemeText(ctx, topText.text, textX, panelH * 0.15, w * 0.6, fontSize);
  }
  if (bottomText) {
    drawMemeText(ctx, bottomText.text, textX, panelH + panelH * 0.15, w * 0.6, fontSize);
  }
}

function renderBrainMeme(
  ctx: CanvasRenderingContext2D,
  texts: MemeText[],
  w: number, h: number,
) {
  const panels = texts.length || 3;
  const panelH = h / panels;
  const brainColors = ['#ffcccc', '#ffddaa', '#ffffaa', '#ccffcc', '#ccccff'];
  const glowIntensity = [0, 0.3, 0.6, 0.9, 1.0];

  for (let i = 0; i < panels; i++) {
    const py = i * panelH;

    // Panel background — increasingly bright
    ctx.fillStyle = brainColors[Math.min(i, brainColors.length - 1)];
    ctx.fillRect(0, py, w, panelH);
    ctx.strokeStyle = '#999';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, py, w, panelH);

    // Brain icon on left (increasingly glowy)
    const brainX = w * 0.12;
    const brainY = py + panelH / 2;
    const brainR = Math.min(panelH * 0.3, w * 0.08);

    // Glow effect
    const glow = glowIntensity[Math.min(i, glowIntensity.length - 1)];
    if (glow > 0) {
      const gradient = ctx.createRadialGradient(brainX, brainY, brainR * 0.5, brainX, brainY, brainR * 2);
      gradient.addColorStop(0, `rgba(255, 255, 100, ${glow * 0.5})`);
      gradient.addColorStop(1, 'rgba(255, 255, 100, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, py, w * 0.25, panelH);
    }

    // Brain shape
    ctx.fillStyle = '#ffaaaa';
    ctx.beginPath();
    ctx.ellipse(brainX, brainY - brainR * 0.1, brainR * 0.8, brainR * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(brainX - brainR * 0.3, brainY + brainR * 0.2, brainR * 0.5, brainR * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(brainX + brainR * 0.3, brainY + brainR * 0.2, brainR * 0.5, brainR * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#cc6666';
    ctx.lineWidth = 1;
    // Brain squiggle
    ctx.beginPath();
    ctx.moveTo(brainX - brainR * 0.4, brainY);
    ctx.quadraticCurveTo(brainX, brainY - brainR * 0.3, brainX + brainR * 0.4, brainY);
    ctx.stroke();

    // Text on right
    const text = texts[i]?.text || '';
    if (text) {
      const fontSize = Math.max(14, Math.min(24, panelH * 0.3));
      drawMemeText(ctx, text, w * 0.25 + (w * 0.75) / 2, py + (panelH - fontSize) / 2, w * 0.7, fontSize);
    }
  }
}

function renderImpactMeme(
  ctx: CanvasRenderingContext2D,
  texts: MemeText[],
  w: number, h: number,
) {
  // Simple solid background
  ctx.fillStyle = '#333333';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.strokeRect(2, 2, w - 4, h - 4);

  const fontSize = Math.max(24, Math.min(48, w / 8));

  const topTexts = texts.filter(t => t.position === 'top');
  const bottomTexts = texts.filter(t => t.position === 'bottom');

  if (topTexts.length > 0) {
    drawMemeText(ctx, topTexts[0].text, w / 2, 16, w, fontSize);
  }

  if (bottomTexts.length > 0) {
    // Calculate height of bottom text to position from bottom
    ctx.font = `bold ${fontSize}px Impact, Arial Black, sans-serif`;
    const lines = wrapText(ctx, bottomTexts[0].text.toUpperCase(), w - 20);
    const textHeight = lines.length * (fontSize + 4);
    drawMemeText(ctx, bottomTexts[0].text, w / 2, h - textHeight - 16, w, fontSize);
  }
}

/**
 * Render a meme to an offscreen canvas and return as data URL.
 * Used for caching the bitmap to avoid re-rendering every frame.
 */
export function renderMemeToBitmap(
  category: MemeCategory,
  variant: string,
  texts: MemeText[],
  width: number,
  height: number,
): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  renderMemeToCanvas(ctx, category, variant, texts, width, height);
  return canvas.toDataURL('image/png');
}
