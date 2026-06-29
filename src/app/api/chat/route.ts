import { google } from '@ai-sdk/google';
import { streamText, tool } from 'ai';
import { z } from 'zod';
import { productService } from '@/lib/services/productService';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: google('gemini-2.5-pro'),
    system: `You are an expert, helpful e-commerce product recommendation assistant. 
    Your goal is to help users find the perfect product based on their needs, budget, and preferences.
    Always try to use the 'findProducts' tool to search for real products to recommend.
    If the user's request is vague, ask clarifying questions.
    When presenting products, be concise and highlight WHY it fits their needs.`,
    messages,
    tools: {
      findProducts: tool({
        description: 'Search for products in the database based on a search term or category.',
        parameters: z.object({
          search: z.string().optional().describe('The search keyword (e.g., "laptop", "wireless headphones").'),
          category: z.string().optional().describe('The product category (e.g., "smartphones", "laptops").'),
        }),
        execute: async ({ search, category }) => {
          console.log(`Executing findProducts with search: ${search}, category: ${category}`);
          const products = await productService.findRecommendations({ search, category });
          return products;
        },
      }),
    },
  });

  return result.toDataStreamResponse();
}
