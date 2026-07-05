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

  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) {
    const errorStream = new ReadableStream<any>({
      start(controller) {
        controller.enqueue({ type: 'text-start', id: 'error_msg' });
        controller.enqueue({ type: 'text-delta', id: 'error_msg', delta: `⚠️ **API Key Missing:**\nPlease add your \`GROQ_API_KEY\` to your environment variables!` });
        controller.enqueue({ type: 'text-end', id: 'error_msg' });
        controller.close();
      }
    });
    return createUIMessageStreamResponse({ stream: errorStream });
  }

  try {
    // Using Groq Llama 3.1 8B Instant for blazing fast speed and reliable tool calling
    model = groq('llama-3.1-8b-instant');
    modelProvider = 'Groq (Llama 3.1 8B)';
  } catch (err: any) {
    const errorStream = new ReadableStream<any>({
      start(controller) {
        controller.enqueue({ type: 'text-start', id: 'error_msg' });
        controller.enqueue({ type: 'text-delta', id: 'error_msg', delta: `⚠️ **API Error:**\nFailed to initialize Groq. Check your API key. Error: ${err.message}` });
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

  const systemPrompt = `You are Kartify AI, a premium personal shopping assistant. Your ONLY job in the first few messages is to GATHER INFORMATION by asking questions — not to search for products.

## MANDATORY INFORMATION TO COLLECT (before calling findProducts):
You MUST collect ALL of the following through questions. Even if the user mentions some of these in their first message, you must still verify or expand on them through at least 3 back-and-forth questions:

1. **Budget** — What is their maximum spend? Even if mentioned, confirm it ("You mentioned ₹3000 — is that flexible or firm?")
2. **Recipient traits** — Who is this for? Their age, gender, lifestyle, interests/hobbies.
3. **Preferences** — Any brand preferences, style preferences, or things to avoid?

## STRICT RULES:
- ❌ NEVER call findProducts before asking at least 3 questions.
- ❌ NEVER assume you have enough info after just 1-2 answers.
- ❌ NEVER skip budget — always ask or confirm it explicitly.
- ✅ Ask exactly ONE question per message.
- ✅ Always end your question with 2–4 suggested options as a Markdown bullet list (the UI renders these as clickable buttons):
  - Option A
  - Option B
  - Option C
- ✅ Keep a warm, conversational tone.

## QUESTION STRATEGY:
Think dynamically — ask the most important MISSING piece of information:
- If budget not mentioned → ask budget first.
- If budget mentioned → confirm it (firm or flexible?), then ask about the recipient.
- If recipient not described → ask their age, gender, and main interests.
- If interests not mentioned → ask about their hobbies or daily routine.
- Gift context → ask about occasion tone (practical vs luxurious, fun vs sentimental).

## PHASE 2 — SEARCH (only after 3+ questions answered)
Once you have collected budget, recipient details, and preferences through at least 3 questions, generate a rich summary and call the findProducts tool.

Summary example: "Birthday gift for a 58-year-old father who is passionate about gardening and has a medium-sized backyard. Budget is ₹3000 (firm). Prefers practical tools or accessories over decorative items."

## PHASE 3 — PRESENT RESULTS
After findProducts returns, present each product warmly and explain specifically WHY it matches what the user shared.`;


  // ── Code-level gate: Only unlock the findProducts tool after the user has
  // answered at least 3 clarifying questions (i.e., 4+ user messages total).
  // This ensures budget, recipient, and preferences are all collected first.
  const toolsToUse = userMessagesCount >= 4 ? tools : {};

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
