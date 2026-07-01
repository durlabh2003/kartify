import { google } from '@ai-sdk/google';
import { streamText, tool, createUIMessageStreamResponse, toUIMessageStream } from 'ai';
import { z } from 'zod';
import { productService } from '../../../lib/services/productService';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages } = await req.json();
  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')?.content || '';
  const userMessagesCount = messages.filter((m: any) => m.role === 'user').length;

  // Check if Gemini API key is configured
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  // Check if the user query already has recipient and budget info
  const hasBudget = /\b\d{3,6}\b|budget|cost|price|rs|inr|under|range/i.test(lastUserMsg);
  const hasRecipient = /mom|mother|dad|father|friend|sister|brother|son|daughter|wife|husband|uncle|aunt|gf|bf|grandfather|grandmother|myself|me|self|kid|boy|girl/i.test(lastUserMsg);

  if (!apiKey) {
    console.warn('[Kartify] GOOGLE_GENERATIVE_AI_API_KEY is missing. Using offline mock stream mode.');
    
    const stream = new ReadableStream<any>({
      async start(controller) {
        try {
          const messageId = `msg_${Math.random().toString(36).substring(2, 9)}`;
          
          // 1. Send text-start event
          controller.enqueue({
            type: 'text-start',
            id: messageId
          });

          // If we haven't asked questions and user has only sent 1 message without full info:
          if (userMessagesCount === 1 && (!hasBudget || !hasRecipient)) {
            const question = `I can help you find that! To make sure I find the perfect match, who is the recipient, and what is your approximate budget?`;
            controller.enqueue({
              type: 'text-delta',
              id: messageId,
              delta: question
            });
            controller.enqueue({
              type: 'text-end',
              id: messageId
            });
            controller.close();
            return;
          }

          // If we are at turn 2 and haven't asked about constraints/brands:
          if (userMessagesCount === 2) {
            const question = `Got it! Are there any specific brand constraints, preferred platforms (Amazon, Myntra, etc.), or key features you care about?`;
            controller.enqueue({
              type: 'text-delta',
              id: messageId,
              delta: question
            });
            controller.enqueue({
              type: 'text-end',
              id: messageId
            });
            controller.close();
            return;
          }

          // Otherwise, perform search recommendation:
          const intro = `Analyzing your request: "${lastUserMsg}"...\nI am filtering out irrelevant platforms based on category to optimize search results.\n`;
          controller.enqueue({
            type: 'text-delta',
            id: messageId,
            delta: intro
          });
          
          await new Promise(resolve => setTimeout(resolve, 800));

          // Identify search term
          let searchTerm = 'laptop';
          let eligiblePlatforms: string[] = ['Amazon', 'Flipkart'];
          const lowerMsg = lastUserMsg.toLowerCase();
          
          if (lowerMsg.includes('phone') || lowerMsg.includes('mobile')) {
            searchTerm = 'smartphones';
            eligiblePlatforms = ['Amazon', 'Flipkart'];
          } else if (lowerMsg.includes('watch')) {
            searchTerm = 'watches';
            eligiblePlatforms = ['Amazon', 'Flipkart'];
          } else if (lowerMsg.includes('fragrance') || lowerMsg.includes('perfume') || lowerMsg.includes('cosmetics') || lowerMsg.includes('skincare')) {
            searchTerm = 'fragrances';
            eligiblePlatforms = ['Nykaa', 'Amazon']; // Eliminated Myntra/Flipkart/Meesho
          } else if (lowerMsg.includes('shoe') || lowerMsg.includes('bag') || lowerMsg.includes('clothing') || lowerMsg.includes('shirt')) {
            searchTerm = 'shoes';
            eligiblePlatforms = ['Myntra', 'Flipkart', 'Amazon', 'Meesho']; // Eliminated Nykaa
          } else if (lowerMsg.includes('headphone') || lowerMsg.includes('earbud') || lowerMsg.includes('audio')) {
            searchTerm = 'audio';
            eligiblePlatforms = ['Amazon', 'Flipkart'];
          }

          // 4. Emit tool-input-start and tool-input-available
          const toolCallId = `call_${Math.random().toString(36).substring(2, 9)}`;
          controller.enqueue({
            type: 'tool-input-start',
            toolCallId,
            toolName: 'findProducts'
          });
          controller.enqueue({
            type: 'tool-input-available',
            toolCallId,
            toolName: 'findProducts',
            input: { search: searchTerm, eligible_platforms: eligiblePlatforms }
          });

          await new Promise(resolve => setTimeout(resolve, 1000));

          // Fetch real products from productService
          let products = await productService.findRecommendations({ 
            search: searchTerm, 
            eligible_platforms: eligiblePlatforms 
          });

          // 6. Emit tool-output-available
          controller.enqueue({
            type: 'tool-output-available',
            toolCallId,
            output: products
          });

          await new Promise(resolve => setTimeout(resolve, 800));

          // 7. Emit concluding message text with Safe, Value, Surprise details
          const outro = `\nBased on your preferences, I searched ${eligiblePlatforms.join(', ')} and eliminated low-probability sites. Here are my top 3 recommendations:
- **Safe Pick**: Well-trusted brand with excellent ratings on ${products[0]?.platform}.
- **Value Pick**: Best price-to-performance ratio on ${products[1]?.platform}.
- **Surprise Pick**: A great alternative choice you'll find on ${products[2]?.platform}.
Let me know if you would like to refine the search!`;
          
          controller.enqueue({
            type: 'text-delta',
            id: messageId,
            delta: outro
          });

          // 8. Emit text-end
          controller.enqueue({
            type: 'text-end',
            id: messageId
          });

          // 9. Close stream
          controller.close();
        } catch (streamErr) {
          console.error('Error in mock stream:', streamErr);
          controller.error(streamErr);
        }
      }
    });

    return createUIMessageStreamResponse({ stream });
  }

  // Standard live mode with API keys
  const tools = {
    findProducts: tool({
      description: 'Search for products in the database based on a search term, category, and eligible platforms.',
      parameters: z.object({
        search: z.string().optional().describe('The search keyword (e.g., "laptop", "wireless headphones").'),
        category: z.string().optional().describe('The product category (e.g., "smartphones", "laptops").'),
        eligible_platforms: z.string().optional().describe('Comma-separated list of platforms that the assistant has deemed high probability (e.g., "Amazon,Flipkart").'),
      }),
      execute: async (args: any) => {
        const { search, category, eligible_platforms } = args;
        console.log(`Executing findProducts with search: ${search}, category: ${category}, eligible_platforms: ${eligible_platforms}`);
        const platforms = eligible_platforms ? eligible_platforms.split(',').map((p: any) => p.trim()) : undefined;
        const products = await productService.findRecommendations({ search, category, eligible_platforms: platforms });
        return products;
      },
    } as any),
  };

  const modelName = 'gemini-1.5-flash';

  const result = streamText({
    model: google(modelName),
    system: `You are Kartify AI, a premium personal shopping assistant for Indian consumers.
    
    Your goal is to understand the user's needs through natural conversation and recommend the best products.
    
    CONVERSATION RULES:
    1. Do not recommend products immediately. You must gather key details: recipient, budget/constraints, and occasion tone.
    2. Ask exactly ONE clarifying question at a time. Keep it natural and conversational.
    3. Once you have the key details (budget, recipient) OR if the user has sent 3 or more messages, call the 'findProducts' tool to perform a product search.
    
    INTELLIGENT PLATFORM ELIMINATION:
    - Before calling 'findProducts', evaluate the product category and eliminate low-probability e-commerce platforms to save latency and bandwidth:
      * Electronics, Gadgets, Laptops, Phones: Keep Amazon, Flipkart. Eliminate Myntra, Nykaa, Meesho.
      * Skincare, Cosmetics, Beauty, Makeup: Keep Nykaa, Amazon. Eliminate Myntra, Flipkart, Meesho.
      * Clothes, Fashion, Shoes, Bags, Accessories: Keep Myntra, Flipkart, Amazon, Meesho. Eliminate Nykaa.
      * Groceries, Food, Daily Essentials: Keep Flipkart, Amazon. Eliminate Myntra, Nykaa, Meesho.
    - Set the 'eligible_platforms' parameter as a comma-separated string (e.g. "Amazon,Flipkart") in the tool call accordingly.

    RECOMMENDATION DISPLAY:
    - After calling the tool, present exactly 3 options (Safe Pick, Value Pick, Surprise Pick) and explain briefly (in 1 sentence per product) "Why this?" selection matches their request.`,
    messages,
    tools,
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.fullStream,
      tools,
      originalMessages: messages
    })
  });
}
