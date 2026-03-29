// OpenRouter service - direct HTTP client for LLM inference via OpenRouter
//
// Uses fetch directly instead of the @openrouter/sdk to avoid SDK Zod
// validation issues with multimodal (image) content parts.
//
// WARNING: The API key (INK_OPENROUTER_API_KEY) is embedded into the client
// bundle at build time and visible in browser DevTools. Only use a scoped,
// low-privilege, rate-limited key. For production, route calls through a
// backend proxy that holds the secret server-side.

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>;
}

export interface JsonSchema {
  name: string;
  strict?: boolean;
  schema: Record<string, unknown>;
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /** JSON mode: 'json' for unstructured JSON, or a json_schema for structured output. */
  responseFormat?: 'json' | { type: 'json_schema'; jsonSchema: JsonSchema };
}

const DEFAULT_MODEL = 'google/gemini-2.5-flash';

/**
 * Send a chat completion request via OpenRouter's REST API.
 */
export async function chatCompletion(
  messages: ChatMessage[],
  options: ChatOptions = {},
): Promise<string> {
  const apiKey = import.meta.env.INK_OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      'INK_OPENROUTER_API_KEY is not set. ' +
      'Add it to your .env.local file (see .env.example).'
    );
  }

  // Build response_format for the API
  let response_format: Record<string, unknown> | undefined;
  if (options.responseFormat === 'json') {
    response_format = { type: 'json_object' };
  } else if (options.responseFormat) {
    response_format = {
      type: 'json_schema',
      json_schema: options.responseFormat.jsonSchema,
    };
  }

  const body: Record<string, unknown> = {
    model: options.model ?? DEFAULT_MODEL,
    messages,
    stream: false,
  };
  if (options.temperature !== undefined) body.temperature = options.temperature;
  if (options.maxTokens !== undefined) body.max_tokens = options.maxTokens;
  if (response_format) body.response_format = response_format;

  const res = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': import.meta.env.INK_OPENROUTER_SITE_URL || window.location.origin,
      'X-Title': import.meta.env.INK_OPENROUTER_SITE_NAME || 'Ink Playground',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenRouter API error ${res.status}: ${text}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await res.json();
  return data?.choices?.[0]?.message?.content?.toString() ?? '';
}

/**
 * Convenience: send a chat request and parse the response as JSON.
 */
export async function chatCompletionJSON<T = unknown>(
  messages: ChatMessage[],
  options: ChatOptions = {},
): Promise<T> {
  const raw = await chatCompletion(messages, {
    ...options,
    responseFormat: options.responseFormat ?? 'json',
  });
  return JSON.parse(raw) as T;
}

/**
 * Send a chat request to an image-generation model and extract the generated image.
 * Returns the image as a data URL (data:image/png;base64,...) or null if no image.
 */
export async function chatCompletionImage(
  messages: ChatMessage[],
  options: ChatOptions = {},
): Promise<string | null> {
  const apiKey = import.meta.env.INK_OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('INK_OPENROUTER_API_KEY is not set.');
  }

  const body: Record<string, unknown> = {
    model: options.model ?? 'google/gemini-2.5-flash-image',
    messages,
    stream: false,
  };
  if (options.temperature !== undefined) body.temperature = options.temperature;
  if (options.maxTokens !== undefined) body.max_tokens = options.maxTokens;

  const res = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': import.meta.env.INK_OPENROUTER_SITE_URL || window.location.origin,
      'X-Title': import.meta.env.INK_OPENROUTER_SITE_NAME || 'Ink Playground',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenRouter API error ${res.status}: ${text}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await res.json();
  const content = data?.choices?.[0]?.message?.content;

  // Log the raw response structure so we can debug the format
  console.log('[OpenRouter] Image gen raw response:', JSON.stringify(data?.choices?.[0]?.message, null, 2)?.slice(0, 2000));

  // Response can be multimodal array or a string
  if (Array.isArray(content)) {
    for (const part of content) {
      // OpenAI-style: { type: "image_url", image_url: { url: "data:..." } }
      if (part.type === 'image_url' && part.image_url?.url) {
        return part.image_url.url;
      }
      // Anthropic-style: { type: "image", source: { data: "base64...", media_type: "image/png" } }
      if (part.type === 'image' && part.source?.data) {
        const mime = part.source.media_type || 'image/png';
        return `data:${mime};base64,${part.source.data}`;
      }
      // Gemini-style: { type: "text", text: "..." } with inline base64
      // or { inlineData: { mimeType: "image/png", data: "base64..." } }
      if (part.inlineData?.data) {
        const mime = part.inlineData.mimeType || 'image/png';
        return `data:${mime};base64,${part.inlineData.data}`;
      }
    }
  }

  // Some models return the image as a plain base64 string
  if (typeof content === 'string' && content.startsWith('data:image')) {
    return content;
  }

  return null;
}

/**
 * Check whether the OpenRouter API key is configured.
 */
export function isOpenRouterConfigured(): boolean {
  return !!import.meta.env.INK_OPENROUTER_API_KEY;
}
