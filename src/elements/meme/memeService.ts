// Meme interpretation service — sends canvas screenshots to a free vision model
// via OpenRouter to understand sketches and generate meme specifications.

import { chatCompletionJSON, isOpenRouterConfigured, type ChatMessage } from '../../ai/OpenRouterService';
import type { MemeCategory, MemeText } from './types';

// Free vision models on OpenRouter (fallback order)
const VISION_MODELS = [
  'google/gemma-3-27b-it:free',
  'nvidia/nemotron-nano-12b-v2-vl:free',
  'google/gemma-3-12b-it:free',
  'google/gemma-3-4b-it:free',
];

export interface MemeInterpretation {
  category: MemeCategory;
  variant?: string;
  texts: MemeText[];
  description: string;
  width?: number;
  height?: number;
}

/**
 * Send a canvas screenshot to the vision model and get a meme interpretation.
 * The model identifies what's drawn, reads any text, and suggests the best meme format.
 */
export async function interpretSketch(
  imageDataUrl: string,
  hint?: string,
): Promise<MemeInterpretation> {
  if (!isOpenRouterConfigured()) {
    throw new Error('OpenRouter API key not configured');
  }

  const systemPrompt = `You are a meme expert. You interpret hand-drawn sketches and convert them into proper meme specifications.

Given a screenshot of a hand-drawn sketch, you must:
1. Read any handwritten text
2. Identify the MOOD and EMOTION of the drawing (happy, sad, angry, smug, thinking, etc.)
3. Pick the best meme CHARACTER that matches that mood
4. Generate a funny, relevant meme caption

IMPORTANT RULES:
- ALWAYS prefer character-based memes (pepe, wojak) over "impact". Impact is ONLY for when text alone is the joke.
- Any face, smiley, expression, or emoji-like drawing → use "pepe" (for positive/neutral/funny moods) or "wojak" (for doomer/sad/chad vibes)
- A simple smiley face = "pepe" with variant "happy" or "comfy"
- A sad face = "pepe" with variant "sad" OR "wojak" with variant "crying"
- An angry face = "pepe" with variant "angry"
- A cool/confident drawing = "wojak" with variant "chad"
- Two things being compared = "drake"
- A progression or ranking = "brain"
- Make the caption TEXT funny and relevant to what's drawn. Be creative and humorous!

Respond with ONLY valid JSON (no markdown, no code fences) in this exact format:
{
  "category": "pepe" | "wojak" | "drake" | "brain" | "impact",
  "variant": "<specific variant>",
  "texts": [
    {"text": "<caption text>", "position": "top" | "bottom"}
  ],
  "description": "<brief description of what you see>",
  "width": 400,
  "height": 400
}

Category details:
- "pepe": Pepe/Apu frog memes. USE THIS FOR MOST DRAWINGS. Variants: "smug", "sad", "angry", "happy", "thinking", "comfy"
- "wojak": Wojak face memes. Variants: "doomer", "bloomer", "chad", "soyjak", "crying"
- "drake": Two-panel Drake format. Must have exactly 2 texts: first with position "top" (rejected thing), second with position "bottom" (approved thing). Use height: 400.
- "brain": Expanding brain. 2-4 texts from least to most "enlightened". All position "custom". Use height: 200 * number_of_panels.
- "impact": Classic Impact font meme. Top and/or bottom text. ONLY use this if no character meme fits.

If a frog is drawn, use "pepe". If ANY face or expression is drawn, use "pepe" or "wojak". Match the variant to the emotion shown.`;

  // Combine system prompt + user request into a single user message.
  // Some free models (e.g. gemma-3-12b) don't support the "system" role.
  const userText = hint
    ? `Interpret this sketch as a meme. Additional context from the user: "${hint}"`
    : 'Interpret this sketch as a meme. What meme format and text should this become?';

  const userContent: Exclude<ChatMessage['content'], string> = [
    {
      type: 'text',
      text: systemPrompt + '\n\n' + userText,
    },
    {
      type: 'image_url',
      image_url: { url: imageDataUrl },
    },
  ];

  const messages: ChatMessage[] = [
    { role: 'user', content: userContent },
  ];

  // Try each vision model, falling back on 429 rate limits
  for (const model of VISION_MODELS) {
    try {
      console.log(`[MemeService] Trying model: ${model}`);
      const parsed = await chatCompletionJSON<Record<string, unknown>>(
        messages,
        { model, temperature: 0.7, maxTokens: 500 },
      );

      return {
        category: (parsed.category as MemeCategory) || 'impact',
        variant: parsed.variant as string | undefined,
        texts: Array.isArray(parsed.texts) ? parsed.texts : [],
        description: (parsed.description as string) || '',
        width: (parsed.width as number) || 400,
        height: (parsed.height as number) || 400,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[MemeService] ${model} failed: ${msg}`);
      // Fall through to next model
    }
  }

  // All models rate-limited
  return {
    category: 'impact',
    texts: [{ text: 'all models rate limited — try again shortly', position: 'top' }],
    description: 'All free vision models are currently rate-limited. Please wait a moment and try again.',
  };
}

/**
 * Interpret the full scene (all canvas content) — used for long-press.
 */
export async function interpretScene(
  imageDataUrl: string,
): Promise<MemeInterpretation> {
  return interpretSketch(imageDataUrl, 'This is the full canvas scene. Interpret the overall composition as a single meme.');
}
