// Meme interpretation service — sends canvas screenshots to a free vision model
// via OpenRouter to understand sketches and generate meme specifications.

import { chatCompletion, chatCompletionImage, isOpenRouterConfigured, type ChatMessage } from '../../ai/OpenRouterService';
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

  const systemPrompt = `You are a meme expert and comedy writer. You interpret hand-drawn sketches and convert them into hilarious meme specifications.

Given a screenshot of a hand-drawn sketch, you must:
1. Read any handwritten text — this is the user's CREATIVE DIRECTION. If they wrote "yo momma joke", they want an actual yo momma joke. If they wrote "when monday", they want a relatable Monday meme. FOLLOW THEIR INTENT.
2. Identify the MOOD and EMOTION of the drawing (happy, sad, angry, smug, thinking, etc.)
3. Pick the best meme CHARACTER that matches that mood
4. Generate ACTUALLY FUNNY caption text that follows the user's intent

CRITICAL — HOW TO HANDLE HANDWRITTEN TEXT:
- If the text describes a TOPIC or GENRE (e.g., "yo momma joke", "monday meme", "coding humor") → Generate an ACTUAL joke/caption about that topic. Do NOT just repeat what they wrote.
- If the text IS a caption (e.g., "when the code compiles") → Use it directly or enhance it to be funnier.
- If the text names an emotion or situation → Build a relatable meme around it.
- NEVER respond with meta-commentary like "when I can't read the prompt" or "something about the drawing". Actually be funny!

IMPORTANT RULES:
- ALWAYS prefer character-based memes (pepe, wojak) over "impact". Impact is ONLY for when text alone is the joke.
- Any face, smiley, expression, or emoji-like drawing → use "pepe" (for positive/neutral/funny moods) or "wojak" (for doomer/sad/chad vibes)
- A simple smiley face = "pepe" with variant "happy" or "comfy"
- A sad face = "pepe" with variant "sad" OR "wojak" with variant "crying"
- An angry face = "pepe" with variant "angry"
- A cool/confident drawing = "wojak" with variant "chad"
- Two things being compared = "drake"
- A progression or ranking = "brain"
- Make the caption TEXT genuinely funny! Think like a top meme creator. Punchlines, wordplay, relatable humor.

Respond with ONLY valid JSON (no markdown, no code fences) in this exact format:
{
  "category": "pepe" | "wojak" | "drake" | "brain" | "impact",
  "variant": "<specific variant>",
  "texts": [
    {"text": "<caption text>", "position": "top" | "bottom"}
  ],
  "description": "<brief description of what you see AND the user's intent>",
  "width": 400,
  "height": 400
}

Category details:
- "pepe": Apu Apustaja / frog memes (the cute wholesome helper frog). USE THIS FOR MOST DRAWINGS. Variants: "smug", "sad", "angry", "happy", "thinking", "comfy"
- "wojak": Wojak face memes. Variants: "doomer", "bloomer", "chad", "soyjak", "crying"
- "drake": Two-panel Drake format. Must have exactly 2 texts: first with position "top" (rejected thing), second with position "bottom" (approved thing). Use height: 400.
- "brain": Expanding brain. 2-4 texts from least to most "enlightened". All position "custom". Use height: 200 * number_of_panels.
- "impact": Classic Impact font meme. Top and/or bottom text. ONLY use this if no character meme fits.

If a frog is drawn, use "pepe". If ANY face or expression is drawn, use "pepe" or "wojak". Match the variant to the emotion shown.`;

  // Combine system prompt + user request into a single user message.
  // Some free models (e.g. gemma-3-12b) don't support the "system" role.
  const userText = hint
    ? `Interpret this sketch as a meme. ${hint}\n\nIMPORTANT: The user's text/intent described above is your PRIMARY creative direction. Generate caption text that DELIVERS on what they asked for — don't just describe or reference it, actually make the joke they're requesting.`
    : 'Interpret this sketch as a meme. What meme format and text should this become? Be genuinely funny!';

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
      const raw = await chatCompletion(messages, { model, temperature: 0.7, maxTokens: 500 });
      // Strip markdown fences if present
      const jsonStr = raw.replace(/```(?:json)?\s*/g, '').replace(/```\s*/g, '').trim();
      const parsed = JSON.parse(jsonStr) as Record<string, unknown>;

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

// Image generation models (paid, ordered by cost)
const IMAGE_GEN_MODELS = [
  'google/gemini-2.5-flash-image',
];

/**
 * Generate a high-fidelity meme image using an image generation model.
 * Takes the interpretation from the vision model and generates an actual image.
 * Returns a data URL or null if generation fails.
 */
export async function generateMemeImage(
  interpretation: MemeInterpretation,
  sketchDataUrl?: string,
  userIntent?: string,
): Promise<string | null> {
  if (!isOpenRouterConfigured()) return null;

  // Build a detailed prompt for the image generation model
  const categoryDescriptions: Record<string, string> = {
    pepe: 'Apu Apustaja (the cute, round, simple green helper frog from the "apu" meme — NOT the edgy Pepe, but the wholesome round-faced Finnish helper frog with big round eyes)',
    wojak: 'Wojak (the classic bald-headed internet meme face character)',
    drake: 'Drake meme format (two panel comparison meme)',
    brain: 'Expanding brain meme',
    impact: 'Classic meme with Impact font text',
  };

  const variantDescriptions: Record<string, string> = {
    // Apu/Pepe variants
    smug: 'with a smug, self-satisfied little smirk, looking pleased with himself',
    sad: 'looking sad with big watery eyes and a little frown, holding back tears',
    angry: 'looking grumpy and annoyed with furrowed brow',
    happy: 'with a big warm happy smile, cheerful and wholesome',
    thinking: 'with a curious thoughtful expression, finger on chin',
    comfy: 'looking cozy and comfortable with a content smile',
    // Wojak variants
    doomer: 'as the Doomer archetype - wearing a dark beanie, dark circles under eyes, cigarette',
    bloomer: 'as the Bloomer archetype - happy, optimistic expression',
    chad: 'as the Chad/Yes Chad archetype - strong jawline, confident, beard',
    soyjak: 'as the Soyjak - open mouth, glasses, excited/pointing expression',
    crying: 'crying intensely with streams of tears',
  };

  const character = categoryDescriptions[interpretation.category] || 'meme character';
  const expression = variantDescriptions[interpretation.variant || ''] || '';
  const topText = interpretation.texts.find(t => t.position === 'top')?.text || '';
  const bottomText = interpretation.texts.find(t => t.position === 'bottom')?.text || '';

  let prompt = `Generate a high-quality meme image of ${character} ${expression}.`;
  prompt += ` Style: classic internet meme, clean digital art, white or light background.`;
  prompt += ` The character should be centered and prominent, taking up most of the image.`;

  if (topText || bottomText) {
    prompt += ` Include meme text in bold white Impact font with black outline:`;
    if (topText) prompt += ` TOP TEXT: "${topText}"`;
    if (bottomText) prompt += ` BOTTOM TEXT: "${bottomText}"`;
  }

  if (userIntent) {
    prompt += ` The user's original creative direction: "${userIntent}" — make sure the meme delivers on this intent.`;
  }
  if (interpretation.description) {
    prompt += ` Context from the original sketch: ${interpretation.description}`;
  }

  // Build messages — optionally include the sketch for reference
  const content: Exclude<ChatMessage['content'], string> = [
    { type: 'text', text: prompt },
  ];

  if (sketchDataUrl) {
    content.push({
      type: 'image_url',
      image_url: { url: sketchDataUrl },
    });
    content[0] = {
      type: 'text',
      text: prompt + '\n\nHere is the user\'s original hand-drawn sketch for reference — use it as inspiration for the pose and composition, but generate a high-quality version.',
    };
  }

  const messages: ChatMessage[] = [
    { role: 'user', content },
  ];

  for (const model of IMAGE_GEN_MODELS) {
    try {
      console.log(`[MemeService] Generating image with: ${model}`);
      const imageUrl = await chatCompletionImage(messages, {
        model,
        temperature: 0.8,
        maxTokens: 4096,
      });

      if (imageUrl) {
        console.log(`[MemeService] Image generated successfully with ${model}`);
        return imageUrl;
      }
      console.warn(`[MemeService] ${model} returned no image`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[MemeService] ${model} image gen failed: ${msg}`);
    }
  }

  return null;
}
