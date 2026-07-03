import { google } from '@ai-sdk/google';
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { createHuggingFace } from '@ai-sdk/huggingface';
import { groq } from '@ai-sdk/groq';
import { streamText, tool, createUIMessageStreamResponse, toUIMessageStream } from 'ai';
import { z } from 'zod';
import { NextRequest } from 'next/server';
import { productService } from '../../../lib/services/productService';
import { verifyAuth } from '../../../lib/middleware/authMiddleware';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

/**
 * Extract the product category from the full conversation history.
 */
function extractCategory(fullText: string): { searchTerm: string; eligiblePlatforms: string[] } {
  const t = fullText.toLowerCase();
  if (t.includes('shoe') || t.includes('sneaker') || t.includes('footwear') || t.includes('sandal') || t.includes('boot')) {
    return { searchTerm: 'shoes', eligiblePlatforms: ['Myntra', 'Flipkart', 'Amazon', 'Meesho'] };
  }
  if (t.includes('shirt') || t.includes('dress') || t.includes('clothing') || t.includes('kurta') || t.includes('jeans') || t.includes('saree')) {
    return { searchTerm: 'clothing', eligiblePlatforms: ['Myntra', 'Meesho', 'Flipkart'] };
  }
  if (t.includes('bag') || t.includes('purse') || t.includes('backpack') || t.includes('handbag')) {
    return { searchTerm: 'bags', eligiblePlatforms: ['Myntra', 'Amazon', 'Flipkart'] };
  }
  if (t.includes('fragrance') || t.includes('perfume') || t.includes('deodorant')) {
    return { searchTerm: 'fragrances', eligiblePlatforms: ['Nykaa', 'Amazon'] };
  }
  if (t.includes('skincare') || t.includes('moisturizer') || t.includes('serum') || t.includes('face wash') || t.includes('sunscreen')) {
    return { searchTerm: 'skincare', eligiblePlatforms: ['Nykaa', 'Amazon'] };
  }
  if (t.includes('makeup') || t.includes('lipstick') || t.includes('foundation') || t.includes('kajal')) {
    return { searchTerm: 'makeup', eligiblePlatforms: ['Nykaa', 'Amazon'] };
  }
  if (t.includes('laptop') || t.includes('computer') || t.includes('macbook')) {
    return { searchTerm: 'laptop', eligiblePlatforms: ['Amazon', 'Flipkart'] };
  }
  if (t.includes('phone') || t.includes('mobile') || t.includes('smartphone') || t.includes('iphone') || t.includes('android')) {
    return { searchTerm: 'smartphone', eligiblePlatforms: ['Amazon', 'Flipkart'] };
  }
  if (t.includes('headphone') || t.includes('earbud') || t.includes('earphone') || t.includes('airpod') || t.includes('audio')) {
    return { searchTerm: 'headphones', eligiblePlatforms: ['Amazon', 'Flipkart'] };
  }
  if (t.includes('watch') || t.includes('smartwatch')) {
    return { searchTerm: 'watches', eligiblePlatforms: ['Amazon', 'Flipkart', 'Myntra'] };
  }
  if (t.includes('book') || t.includes('novel')) {
    return { searchTerm: 'books', eligiblePlatforms: ['Amazon', 'Flipkart'] };
  }
  if (t.includes('toy') || t.includes('game') || t.includes('lego')) {
    return { searchTerm: 'toys', eligiblePlatforms: ['Amazon', 'Flipkart'] };
  }
  if (t.includes('jewellery') || t.includes('jewelry') || t.includes('necklace') || t.includes('ring') || t.includes('bracelet')) {
    return { searchTerm: 'jewellery', eligiblePlatforms: ['Myntra', 'Amazon', 'Nykaa'] };
  }
  if (t.includes('gift') || t.includes('present')) {
    return { searchTerm: 'gift', eligiblePlatforms: ['Amazon', 'Flipkart', 'Myntra'] };
  }
  // Default — no category found yet
  return { searchTerm: '', eligiblePlatforms: ['Amazon', 'Flipkart'] };
}

/**
 * Extract a numeric budget (in INR) from the full conversation history.
 * Returns null if not found.
 */
function extractBudget(fullText: string): number | null {
  // Matches patterns like "1000", "₹1000", "Rs 1000", "under 1000", "budget 1000", "1k", "10k"
  const kMatch = fullText.match(/\b(\d+(?:\.\d+)?)\s*k\b/i);
  if (kMatch) return parseFloat(kMatch[1]) * 1000;

  const patterns = [
    /(?:₹|rs\.?|inr|budget|under|within|around|upto|up to|below|max|maximum)\s*(\d{3,6})/gi,
    /\b(\d{3,6})\s*(?:rupees?|rs\.?|inr|bucks?)\b/gi,
    /\b(\d{3,6})\b/g, // last resort: bare numbers with 3-6 digits
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(fullText);
    if (match) {
      const val = parseInt(match[1], 10);
      if (val >= 100 && val <= 500000) return val;
    }
  }
  return null;
}

export async function POST(req: Request) {
  // Convert standard Request to NextRequest for middleware compatibility
  const nextReq = new NextRequest(req.url, {
    headers: req.headers,
    method: req.method,
    body: req.body,
  });

  // Verify auth if authorization header is provided (for production readiness)
  const authHeader = req.headers.get('authorization');
  let user = null;
  if (authHeader) {
    const { user: authedUser, error: authError } = await verifyAuth(nextReq);
    if (authError) {
      console.warn('[Kartify API] Auth verification failed:', authError);
    } else {
      user = authedUser;
      console.log('[Kartify API] Authenticated user ID:', user.id);
    }
  }

  const { messages } = await req.json();
  const lastUserMsg = [...messages].reverse().find((m: any) => m.role === 'user')?.content || '';
  const userMessagesCount = messages.filter((m: any) => m.role === 'user').length;

  // Extract full conversation text for context analysis
  const fullChatText = messages
    .map((m: any) => {
      if (typeof m.content === 'string') return m.content;
      if (Array.isArray(m.content)) return m.content.map((p: any) => p.text || '').join(' ');
      if (m.parts) return (Array.isArray(m.parts) ? m.parts : [m.parts]).map((p: any) => p.text || p).join(' ');
      return '';
    })
    .join(' ')
    .toLowerCase();

  const hasBudget = /\b\d{3,6}\b|budget|cost|price|rs|inr|under|range/i.test(lastUserMsg) ||
    /\b\d{3,6}\b|budget|cost|price|rs|inr|under|range/i.test(fullChatText);
  const hasRecipient = /mom|mother|dad|father|friend|sister|brother|son|daughter|wife|husband|uncle|aunt|gf|bf|grandfather|grandmother|myself|me|self|kid|boy|girl/i.test(fullChatText);

  // Extract category and budget from full conversation for pre-fetch and offline mode
  const { searchTerm: detectedCategory, eligiblePlatforms: detectedPlatforms } = extractCategory(fullChatText);
  const detectedBudget = extractBudget(fullChatText);

  // ─── Model Selection ───────────────────────────────────────────────────────
  // Priority: Hugging Face -> Gemini (supports tools) -> Groq -> OpenRouter free -> Anthropic -> OpenAI
  let model: any = null;
  let modelProvider = '';

  if (process.env.HUGGINGFACE_API_KEY) {
    const huggingface = createHuggingFace({
      apiKey: process.env.HUGGINGFACE_API_KEY,
    });
    
    // Using native huggingface provider with the meta-llama model
    model = huggingface('meta-llama/Meta-Llama-3-8B-Instruct');
    modelProvider = 'Hugging Face (Llama-3-8B)';
  }

  const geminiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;
  if (!model && geminiKey) {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = geminiKey;
    try {
      model = google('gemini-2.0-flash');
      modelProvider = 'Google Gemini 2.0 Flash';
    } catch {
      console.warn('[Kartify] Gemini init failed, falling back to Groq.');
    }
  }

  if (!model && process.env.GROQ_API_KEY) {
    model = groq('llama-3.3-70b-versatile');
    modelProvider = 'Groq Llama 3.3';
  } else if (!model && process.env.OPENROUTER_API_KEY) {
    const openrouter = createOpenAICompatible({
      name: 'openrouter',
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY,
      headers: {
        'HTTP-Referer': 'https://kartify.vercel.app',
        'X-Title': 'Kartify AI',
      },
    });
    const freeModels = [
      'nvidia/nemotron-3-nano-30b-a3b:free',
      'google/gemma-4-26b-a4b-it:free',
      'liquid/lfm-2.5-1.2b-instruct:free',
    ];
    const modelIndex = Math.floor(Date.now() / 30000) % freeModels.length;
    model = openrouter.chatModel(freeModels[modelIndex]);
    modelProvider = `OpenRouter (${freeModels[modelIndex]})`;
  } else if (!model && process.env.ANTHROPIC_API_KEY) {
    model = anthropic('claude-3-5-sonnet-latest');
    modelProvider = 'Anthropic Claude';
  } else if (!model && process.env.OPENAI_API_KEY) {
    model = openai('gpt-4o-mini');
    modelProvider = 'OpenAI GPT';
  }

  if (!model) {
    console.warn('[Kartify] No LLM API Keys configured. Using offline mock stream mode.');

    const stream = new ReadableStream<any>({
      async start(controller) {
        try {
          const messageId = `msg_${Math.random().toString(36).substring(2, 9)}`;

          controller.enqueue({ type: 'text-start', id: messageId });

          const hasProductsAlready = messages.some((m: any) => m.parts?.some((p: any) => p.type?.startsWith('tool-')));
          const isRefinement = hasProductsAlready || userMessagesCount > 2;

          if (!isRefinement) {
            if (userMessagesCount === 1 && (!hasBudget || !hasRecipient)) {
              const question = `I can help you find that! To make sure I find the perfect match, who is the recipient, and what is your approximate budget?`;
              controller.enqueue({ type: 'text-delta', id: messageId, delta: question });
              controller.enqueue({ type: 'text-end', id: messageId });
              controller.close();
              return;
            }
            if (userMessagesCount === 2) {
              const question = `Got it! Are there any specific brand constraints, preferred platforms (Amazon, Myntra, etc.), or key features you care about?`;
              controller.enqueue({ type: 'text-delta', id: messageId, delta: question });
              controller.enqueue({ type: 'text-end', id: messageId });
              controller.close();
              return;
            }
          }

          // Use smarter category detection
          let searchTerm = detectedCategory || 'smartphones';
          let eligiblePlatforms = detectedPlatforms;

          // Override with explicit platform mention in last message
          const lowerMsg = lastUserMsg.toLowerCase();
          if (lowerMsg.includes('amazon')) eligiblePlatforms = ['Amazon'];
          else if (lowerMsg.includes('flipkart')) eligiblePlatforms = ['Flipkart'];
          else if (lowerMsg.includes('myntra')) eligiblePlatforms = ['Myntra'];
          else if (lowerMsg.includes('nykaa')) eligiblePlatforms = ['Nykaa'];
          else if (lowerMsg.includes('meesho')) eligiblePlatforms = ['Meesho'];

          let intro = `Analyzing your request...\nSearching ${eligiblePlatforms.join(', ')} for ${searchTerm}${detectedBudget ? ` under ₹${detectedBudget.toLocaleString('en-IN')}` : ''}.\n`;
          if (isRefinement) intro = `Applying refinement: "${lastUserMsg}"...\n`;

          controller.enqueue({ type: 'text-delta', id: messageId, delta: intro });
          await new Promise(resolve => setTimeout(resolve, 800));

          const toolCallId = `call_${Math.random().toString(36).substring(2, 9)}`;
          controller.enqueue({ type: 'tool-input-start', toolCallId, toolName: 'findProducts' });
          controller.enqueue({
            type: 'tool-input-available',
            toolCallId,
            toolName: 'findProducts',
            input: { search: searchTerm, eligible_platforms: eligiblePlatforms.join(','), max_budget: detectedBudget ?? undefined }
          });

          await new Promise(resolve => setTimeout(resolve, 1000));

          let products = await productService.findRecommendations({
            search: searchTerm,
            eligible_platforms: eligiblePlatforms,
            maxBudget: detectedBudget ?? undefined,
          });

          const isCheaper = lowerMsg.includes('cheaper') || lowerMsg.includes('less') || lowerMsg.includes('low');
          const isPremium = lowerMsg.includes('premium') || lowerMsg.includes('expensive') || lowerMsg.includes('quality') || lowerMsg.includes('high');

          products = products.map((p) => {
            let adjustedPrice = p.price;
            let titlePrefix = '';
            if (isCheaper) { adjustedPrice = Math.round(p.price * 0.6); titlePrefix = 'Budget '; }
            else if (isPremium) { adjustedPrice = Math.round(p.price * 1.8); titlePrefix = 'Premium '; }
            return {
              ...p,
              title: titlePrefix + p.title,
              price: adjustedPrice,
              whyThis: isCheaper
                ? `Refined budget option. Offers high value for money at just ₹${adjustedPrice.toLocaleString('en-IN')}.`
                : isPremium
                  ? `Refined premium option with top-tier builds and features.`
                  : p.whyThis
            };
          });

          controller.enqueue({ type: 'tool-output-available', toolCallId, output: products });
          await new Promise(resolve => setTimeout(resolve, 800));

          let outro = `\nHere are my top 3 picks for **${searchTerm}**${detectedBudget ? ` under ₹${detectedBudget.toLocaleString('en-IN')}` : ''} from ${eligiblePlatforms.join(', ')}:\n- 🛡️ **Safe Pick**: ${products[0]?.title || 'Top rated option'} on ${products[0]?.platform}\n- 💰 **Value Pick**: ${products[1]?.title || 'Best value option'} on ${products[1]?.platform}\n- 🎲 **Surprise Pick**: ${products[2]?.title || 'Unique choice'} on ${products[2]?.platform}\nLet me know if you'd like to refine!`;

          if (isRefinement) {
            outro = `\nUpdated picks based on your refinement:\n- 🛡️ ${products[0]?.title} on ${products[0]?.platform}\n- 💰 ${products[1]?.title} on ${products[1]?.platform}\n- 🎲 ${products[2]?.title} on ${products[2]?.platform}\nLet me know if you need anything else!`;
          }

          controller.enqueue({ type: 'text-delta', id: messageId, delta: outro });
          controller.enqueue({ type: 'text-end', id: messageId });
          controller.close();
        } catch (streamErr) {
          console.error('Error in mock stream:', streamErr);
          controller.error(streamErr);
        }
      }
    });

    return createUIMessageStreamResponse({ stream });
  }

  console.log(`[Kartify API] Routing query using: ${modelProvider}`);

  // Standard live mode with API keys
  const tools = {
    findProducts: tool({
      description: 'Search for real products from Indian e-commerce platforms (Amazon.in, Flipkart, Myntra, Nykaa, Meesho). Call this whenever you have enough context to recommend products.',
      parameters: z.object({
        query: z.string().describe('Natural language product search query including product type, budget in INR, and intended platforms. Example: "gym shoes under ₹1900 for men on Myntra and Flipkart"'),
      }),
      execute: async ({ query }: { query: string }) => {
        console.log(`[findProducts] query="${query}"`);

        // Extract search term from the query
        const { searchTerm, eligiblePlatforms } = extractCategory(query + ' ' + fullChatText);
        const budget = extractBudget(query) ?? detectedBudget ?? undefined;
        const search = searchTerm || query.split(' ').slice(0, 3).join(' ');
        const platforms = eligiblePlatforms.length > 0 ? eligiblePlatforms : detectedPlatforms;

        console.log(`[findProducts] → search="${search}", platforms=[${platforms.join(',')}], budget=₹${budget}`);

        const products = await productService.findRecommendations({
          search,
          eligible_platforms: platforms,
          maxBudget: budget,
        });
        return products;
      },
    } as any),
  };

  // Strip complex message types for models that only accept simple chat format
  const coreMessages = messages
    .filter((m: any) => m.role === 'user' || m.role === 'assistant')
    .map((m: any) => {
      let content = '';
      if (typeof m.content === 'string') {
        content = m.content;
      } else if (Array.isArray(m.content)) {
        content = m.content
          .filter((p: any) => p.type === 'text' || typeof p === 'string')
          .map((p: any) => (typeof p === 'string' ? p : p.text || ''))
          .join('\n');
      } else if (m.parts) {
        if (typeof m.parts === 'string') {
          content = m.parts;
        } else if (Array.isArray(m.parts)) {
          content = m.parts
            .filter((p: any) => p.type === 'text' || typeof p === 'string')
            .map((p: any) => (typeof p === 'string' ? p : p.text || ''))
            .join('\n');
        }
      }
      return { role: m.role as 'user' | 'assistant', content: content || '' };
    })
    .filter((m: any) => m.content.trim() !== '');

  // Determine if this model supports tool calling reliably.
  // Gemini: YES. Groq/OpenRouter free models: NO (schema validation errors in multi-turn).
  const supportsTools = modelProvider.includes('Gemini');

  // ── System prompts: one for Gemini (tool-calling), one for Groq (text mode) ──
  const systemPromptWithTools = `You are Kartify AI, a premium personal shopping assistant for Indian consumers.

CONVERSATION RULES:
1. Ask at most ONE clarifying question at a time.
2. Gather: (a) product type, (b) who it's for, (c) budget in INR.
3. Once you have product + budget, call findProducts immediately.
4. Never recommend from memory — always use the findProducts tool.

WHEN YOU CALL findProducts:
- Pass a single "query" string, e.g. "gym shoes under ₹1900 on Myntra and Flipkart"

AFTER TOOL RETURNS:
- Show exactly 3 picks: 🛡️ Safe Pick | 💰 Value Pick | 🎲 Surprise Pick
- Use EXACT names, prices, platforms from the tool result.`;

  const systemPromptTextMode = `You are Kartify AI, a premium personal shopping assistant for Indian consumers.

CONVERSATION RULES:
1. Ask at most ONE clarifying question at a time. Keep it short.
2. Gather: (a) product type, (b) who it's for, (c) budget in INR.
3. Once you have enough info, present recommendations DIRECTLY from the REAL PRODUCT DATA below.

CRITICAL RULES:
- Do NOT say "I'll search", "waiting for results", or "let me check" — you already have the products below.
- Do NOT call any tools or functions.
- Present the products IMMEDIATELY using this format:

🛡️ **Safe Pick** — [Product Name] | ₹[Price] | [Platform] | [Why: 1 sentence]
💰 **Value Pick** — [Product Name] | ₹[Price] | [Platform] | [Why: 1 sentence]
🎲 **Surprise Pick** — [Product Name] | ₹[Price] | [Platform] | [Why: 1 sentence]

Use ONLY products listed in REAL PRODUCT DATA. Never invent names or prices.`;

  const systemPrompt = supportsTools ? systemPromptWithTools : systemPromptTextMode;

  // Pre-fetch real products whenever we have enough context.
  let productContext = '';
  const shouldPrefetch = detectedCategory && (hasBudget || hasRecipient || userMessagesCount >= 2);
  if (shouldPrefetch) {
    try {
      console.log(`[Kartify] Pre-fetching products: category="${detectedCategory}" budget=₹${detectedBudget}`);
      const products = await productService.findRecommendations({
        search: detectedCategory,
        eligible_platforms: detectedPlatforms,
        maxBudget: detectedBudget ?? undefined,
      });
      if (products && products.length > 0) {
        productContext = '\n\nREAL PRODUCT DATA (present these directly as your recommendations):\n' +
          products.slice(0, 6).map((p: any, i: number) =>
            `${i + 1}. "${p.title}" — ₹${p.price.toLocaleString('en-IN')} on ${p.platform} | Rating: ${p.rating}/5 | URL: ${p.url || getSearchUrl(p.platform, p.title)}`
          ).join('\n');
      }
    } catch (e) {
      console.warn('[Kartify] Product pre-fetch failed:', e);
    }
  }

  const finalSystemPrompt = systemPrompt + productContext;

  const runStream = (mdl: any, withTools: boolean) => {
    if (withTools) {
      return streamText({ model: mdl, system: finalSystemPrompt, messages: coreMessages, tools });
    }
    return streamText({ model: mdl, system: finalSystemPrompt, messages: coreMessages });
  };

  let result;
  try {
    result = runStream(model, supportsTools);
    await result.usage;
  } catch (err: any) {
    const isRateLimit = err?.message?.includes('quota') || err?.message?.includes('rate') || err?.statusCode === 429 || err?.status === 429;
    if (isRateLimit && process.env.GROQ_API_KEY && modelProvider.includes('Gemini')) {
      console.warn('[Kartify] Gemini rate-limited. Falling back to Groq (text mode with injected products).');
      const fallbackModel = groq('llama-3.3-70b-versatile');

      // Products were already pre-fetched above — reuse productContext.
      // If not pre-fetched yet (budget/category just arrived), fetch now.
      let fallbackContext = productContext;
      if (!fallbackContext && detectedCategory) {
        try {
          const prefetched = await productService.findRecommendations({
            search: detectedCategory,
            eligible_platforms: detectedPlatforms,
            maxBudget: detectedBudget ?? undefined,
          });
          if (prefetched.length > 0) {
            fallbackContext = '\n\nREAL PRODUCT DATA — present ONLY these products as your recommendations:\n' +
              prefetched.slice(0, 6).map((p: any, i: number) =>
                `${i + 1}. "${p.title}" — ₹${p.price.toLocaleString('en-IN')} on ${p.platform} | Rating: ${p.rating}/5`
              ).join('\n') +
              '\n\nFormat: 🛡️ Safe Pick / 💰 Value Pick / 🎲 Surprise Pick. Use ONLY these products.';
          }
        } catch (e) {
          console.warn('[Kartify] Groq fallback pre-fetch failed:', e);
        }
      }

      // Use Groq in plain text mode — NO tool calling (unreliable in multi-turn)
      const fallbackStream = streamText({
        model: fallbackModel,
        system: systemPrompt + fallbackContext,
        messages: coreMessages,
      });
      return createUIMessageStreamResponse({
        stream: toUIMessageStream({ stream: fallbackStream.fullStream, tools: {}, originalMessages: messages })
      });
    }
    
    console.error('[Kartify API Error]', err);
    const errorMsg = err?.message || err?.toString() || 'Unknown error occurred.';
    const errorStream = new ReadableStream<any>({
      start(controller) {
        controller.enqueue({ type: 'text-start', id: 'error_msg' });
        controller.enqueue({ type: 'text-delta', id: 'error_msg', delta: `⚠️ **Deployment Error Debug:**\n${errorMsg}\n\nPlease share this error message with me!` });
        controller.enqueue({ type: 'text-end', id: 'error_msg' });
        controller.close();
      }
    });
    return createUIMessageStreamResponse({ stream: errorStream });
  }

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.fullStream,
      tools: supportsTools ? tools : {},
      originalMessages: messages
    })
  });
}

// Helper used in offline mode for link generation
function getSearchUrl(platform: string, productName: string): string {
  const urls: Record<string, (q: string) => string> = {
    Amazon:   (q) => `https://www.amazon.in/s?k=${encodeURIComponent(q)}`,
    Flipkart: (q) => `https://www.flipkart.com/search?q=${encodeURIComponent(q)}`,
    Myntra:   (q) => `https://www.myntra.com/search?rawQuery=${encodeURIComponent(q)}`,
    Nykaa:    (q) => `https://www.nykaa.com/search/result/?q=${encodeURIComponent(q)}&root=true`,
    Meesho:   (q) => `https://www.meesho.com/search?q=${encodeURIComponent(q)}`,
  };
  return (urls[platform] || urls['Amazon'])(productName);
}
