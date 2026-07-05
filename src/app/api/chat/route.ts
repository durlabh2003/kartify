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
  let model: any = null;
  let modelProvider = '';

  const openrouterKey = process.env.OPENROUTER_API_KEY;
  if (!openrouterKey) {
    const errorStream = new ReadableStream<any>({
      start(controller) {
        controller.enqueue({ type: 'text-start', id: 'error_msg' });
        controller.enqueue({ type: 'text-delta', id: 'error_msg', delta: `⚠️ **API Key Missing:**\nPlease add your \`OPENROUTER_API_KEY\` to your environment variables!` });
        controller.enqueue({ type: 'text-end', id: 'error_msg' });
        controller.close();
      }
    });
    return createUIMessageStreamResponse({ stream: errorStream });
  }

  try {
    const openrouter = createOpenAICompatible({
      name: 'openrouter',
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: openrouterKey,
    });
    // Using the free tier of OpenAI OSS 20B through OpenRouter (confirmed live)
    model = openrouter('openai/gpt-oss-20b:free');
    modelProvider = 'OpenRouter (OpenAI OSS 20B Free)';
  } catch (err: any) {
    const errorStream = new ReadableStream<any>({
      start(controller) {
        controller.enqueue({ type: 'text-start', id: 'error_msg' });
        controller.enqueue({ type: 'text-delta', id: 'error_msg', delta: `⚠️ **API Error:**\nFailed to initialize OpenRouter. Check your API key. Error: ${err.message}` });
        controller.enqueue({ type: 'text-end', id: 'error_msg' });
        controller.close();
      }
    });
    return createUIMessageStreamResponse({ stream: errorStream });
  }

  console.log(`[Kartify API] Routing query using: ${modelProvider}`);

  // Standard live mode with API keys
  const tools = {
    findProducts: tool({
      description: 'Search for real products from our n8n backend model. Call this ONLY when you have asked all necessary questions and have a complete summary of the user\'s needs.',
      parameters: z.object({
        summary: z.string().describe('A comprehensive summary of all user requirements, preferences, budget, and traits collected during the interview. Example: "Looking for men\'s running shoes under 2000 INR. Prefers Nike or Puma. Needs good arch support."'),
      }),
      execute: async ({ summary }: { summary: string }) => {
        console.log(`[findProducts] summary="${summary}"`);

        const products = await productService.findRecommendations({ summary });
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

  const systemPrompt = `You are Kartify AI, a premium personal shopping assistant. Your job is to first UNDERSTAND the user's needs through conversation, and only THEN search for products.

## YOUR WORKFLOW (FOLLOW THIS STRICTLY, IN ORDER):

### PHASE 1 — INTERVIEW (MANDATORY, DO NOT SKIP)
You MUST ask clarifying questions before EVER calling the findProducts tool. Even if the user's first message seems complete (e.g., "birthday gift for Dad, budget 3000"), you MUST still ask at least 2 follow-up questions.

NEVER call findProducts on the first user message. NEVER.

Think dynamically: what information is MISSING that would help find the PERFECT product?
Examples of what to ask based on context:
- Gift for someone → Ask about their age, interests, hobbies, or lifestyle.
- Clothing → Ask about preferred style, size, occasion.
- Electronics → Ask about use case, preferred brand, key features needed.
- Skincare → Ask about skin type, concerns (acne, dryness, etc.), preferred ingredients.

RULES for each question:
1. Ask exactly ONE question per message.
2. Always end your message with 2–4 clickable options as a Markdown bullet list:
   - Option A
   - Option B
   - Option C
3. Keep your tone warm, helpful, and conversational.

### PHASE 2 — SEARCH (ONLY after 2+ clarifying questions have been answered)
Once you have gathered enough context (minimum 2 answered follow-up questions covering key traits like interests, preferences, or specific needs), STOP asking questions.

Generate a detailed \`summary\` string that captures everything: the product type, recipient, occasion, budget, preferences, and any constraints. Then call the \`findProducts\` tool with that summary.

Example summary: "Looking for a birthday gift for a 55-year-old father who enjoys reading and gardening. Budget is ₹3000. Prefers practical, useful gifts over decorative ones."

### PHASE 3 — PRESENT RESULTS
After findProducts returns, present the products in a warm, personalized way. Explain WHY each product was chosen based on the specific information the user shared.

## CRITICAL RULES:
- ❌ NEVER call findProducts immediately after the user's first message.
- ❌ NEVER skip the interview phase, even if the user provides a lot of details upfront.
- ✅ ALWAYS ask at least 2 clarifying questions first.
- ✅ ALWAYS end Phase 1 messages with a bullet-list of options.`;


  // ── Code-level gate: Only unlock the findProducts tool after the user has
  // answered at least 2 clarifying questions (i.e., 3+ user messages total).
  // This prevents the model from skipping the interview phase entirely,
  // regardless of what the system prompt says.
  const toolsToUse = userMessagesCount >= 3 ? tools : {};

  const runStream = (mdl: any) => {
    return streamText({ model: mdl, system: systemPrompt, messages: coreMessages, tools: toolsToUse });
  };

  let result;
  try {
    result = runStream(model);
  } catch (err: any) {
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

  // ── Native Tool Calling Stream (Gemini) ──
  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.fullStream,
      tools: tools,
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
