import { NextResponse } from 'next/server';
import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';
import { isAmazonConfigured, searchAmazon } from '../../../lib/amazon-paapi.js';
import { getSearchUrl, getPlaceholderImage } from '../../../lib/smart-links.js';

// ─── System Prompt ──────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `
You are the "Kartify Brain", a friendly AI shopping assistant for Indian consumers.

Your personality: warm, concise, conversational. Never say "Great question!". Get to the point.

CRITICAL RULES:

1. UNLIMITED CATEGORIES: Handle ANY product type — electronics, fashion, groceries, beauty, home decor, toys, specialty items, anything.

2. PLATFORM ELIMINATION: For each query, eliminate platforms where the product is unlikely to be found.
   Available platforms: ["Amazon", "Flipkart", "Myntra", "Nykaa", "Meesho"]
   - Electronics/gadgets → keep Amazon, Flipkart. Remove Nykaa, Myntra.
   - Beauty/skincare → keep Nykaa, Amazon. Possibly Flipkart.
   - Fashion/clothing → keep Myntra, Meesho, Amazon.
   - Budget fashion → keep Meesho, Myntra.
   - General/home → keep Amazon, Flipkart.
   Always keep at least 2 platforms.

3. CLARIFICATION: If the request is missing budget, occasion, or recipient info that would significantly change the recommendation — ask ONE targeted question and return products: [].

4. REAL PRODUCT NAMES: When recommending products, use REALISTIC Indian market product names — actual brand names and model numbers that would realistically exist. Examples:
   - NOT: "Budget-Friendly earphones – Best Value"
   - YES: "boAt Rockerz 255 Pro+ Wireless Neckband"
   - NOT: "Popular mobile cover"  
   - YES: "Spigen Rugged Armor Back Cover for Redmi Note 13"

5. THREE DISTINCT PICKS when ready:
   - "Safe": Reliable, top-rated, well-known brand (e.g., Sony, Samsung, Levi's, Lakme)
   - "Value": Best price-to-quality, may be emerging brand (e.g., boAt, Noise, Mivi, The Man Company)
   - "Surprise": Creative, unique, or unexpected option — something they wouldn't normally find

6. REALISTIC PRICING: Use real Indian market prices in INR. Research-based estimates.
   - Wireless earbuds: ₹800–₹15,000
   - Phone covers: ₹200–₹2,500
   - Skincare serums: ₹300–₹3,000
   - Gaming chairs: ₹8,000–₹50,000

7. WHY THIS: 1-2 specific sentences linking the product to the user's stated context.

8. SEARCH TERM: Provide a clean, concise searchQuery for each product (brand + model, 3-6 words max). This is used to find it on the platform.
`;

// ─── Schemas ────────────────────────────────────────────────────────────────
const ProductSchema = z.object({
  name: z.string().describe('Realistic product name with brand and model'),
  searchQuery: z.string().describe('Short clean search term for this product, 3-6 words'),
  price: z.number().describe('Realistic price in INR'),
  platform: z.string().describe('One of the eligible platforms'),
  rating: z.number().min(1).max(5),
  pickType: z.enum(['Safe', 'Value', 'Surprise']),
  deliveryEstimate: z.string().describe('e.g. "Tomorrow by 9 PM" or "2–3 days"'),
  whyThis: z.string().describe('1-2 sentences explaining why this matches the user need'),
});

const ResponseSchema = z.object({
  reply: z.string().describe('Conversational response to the user.'),
  updatedContext: z.object({
    platforms: z.array(z.string()).describe('Eligible platforms after elimination'),
    budget: z.string().nullable(),
  }),
  products: z.array(ProductSchema).max(3).describe('Exactly 3 products if ready, else []'),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────
function buildSmartMockProducts(userMessage) {
  const msg = (userMessage || '').toLowerCase();

  // Determine category for platform selection
  const isElectronics = /pc|laptop|phone|mobile|earbuds|earphone|headphone|gaming|tablet|charger|cable|speaker|camera/i.test(msg);
  const isFashion     = /dress|shirt|jeans|shoes|fashion|clothes|wear|kurta|saree|sneaker/i.test(msg);
  const isBeauty      = /lipstick|makeup|skincare|cream|serum|beauty|hair|face wash|sunscreen|moisturizer/i.test(msg);
  const isHome        = /pillow|furniture|lamp|decor|kitchen|curtain|bedsheet|storage/i.test(msg);

  const platforms = isElectronics ? ['Amazon', 'Flipkart']
    : isBeauty   ? ['Nykaa', 'Amazon']
    : isFashion  ? ['Myntra', 'Meesho', 'Amazon']
    : isHome     ? ['Amazon', 'Flipkart']
    : ['Amazon', 'Flipkart'];

  // Generate realistic category-specific mock products
  const mockSets = {
    earphone: [
      { name: 'Sony WH-1000XM5 Wireless Headphones', searchQuery: 'Sony WH-1000XM5 headphones', price: 24990, platform: 'Amazon', rating: 4.8, pickType: 'Safe', deliveryEstimate: 'Tomorrow by 9 PM', whyThis: 'Industry-leading noise cancellation and 30-hour battery — the gold standard for wireless headphones in India.' },
      { name: 'boAt Rockerz 255 Pro+ Wireless Neckband', searchQuery: 'boAt Rockerz 255 Pro neckband', price: 1299, platform: 'Amazon', rating: 4.3, pickType: 'Value', deliveryEstimate: '2–3 days', whyThis: 'Most popular budget neckband in India with 40hr battery and IPX7 sweat resistance — unbeatable at this price.' },
      { name: 'Nothing Ear (2) True Wireless Earbuds', searchQuery: 'Nothing Ear 2 earbuds', price: 8999, platform: 'Flipkart', rating: 4.6, pickType: 'Surprise', deliveryEstimate: '2–3 days', whyThis: 'Transparent design that turns heads, plus Hi-Res Audio and ANC that rivals earbuds twice the price.' },
    ],
    phone_cover: [
      { name: 'Spigen Tough Armor Case', searchQuery: 'Spigen Tough Armor Redmi cover', price: 1299, platform: 'Amazon', rating: 4.7, pickType: 'Safe', deliveryEstimate: 'Tomorrow', whyThis: 'Military-grade drop protection with a reinforced bumper — the most trusted case brand globally.' },
      { name: 'CEDO Impact Proof Silicone Back Cover', searchQuery: 'CEDO silicone Redmi back cover', price: 299, platform: 'Flipkart', rating: 4.2, pickType: 'Value', deliveryEstimate: '2–3 days', whyThis: 'Perfect slim fit, great grip, and at ₹299 you can buy one for every mood.' },
      { name: 'Dbrand Matte Skin + Grip Case Bundle', searchQuery: 'Dbrand skin grip case Redmi', price: 2799, platform: 'Amazon', rating: 4.9, pickType: 'Surprise', deliveryEstimate: '3–5 days', whyThis: 'Premium textured skin that changes the entire look and feel of your phone — a conversation starter.' },
    ],
    skincare: [
      { name: 'Minimalist 10% Niacinamide Serum', searchQuery: 'Minimalist Niacinamide serum', price: 599, platform: 'Nykaa', rating: 4.7, pickType: 'Safe', deliveryEstimate: '2–3 days', whyThis: 'Dermatologist-favourite serum for oily skin — clinically proven to reduce pores and control sebum.' },
      { name: 'Dot & Key Pore Minimizing Serum', searchQuery: 'Dot Key pore serum Nykaa', price: 449, platform: 'Nykaa', rating: 4.4, pickType: 'Value', deliveryEstimate: '2–3 days', whyThis: 'Indian-brand favourite with niacinamide + zinc PCA combo — great results at half the price of international brands.' },
      { name: 'Some By Mi AHA BHA PHA 30 Days Miracle Toner', searchQuery: 'Some By Mi toner Nykaa', price: 1200, platform: 'Nykaa', rating: 4.8, pickType: 'Surprise', deliveryEstimate: '3–4 days', whyThis: 'Korean skincare cult-favourite that visibly reduces acne, pores and texture within 30 days — extraordinary results.' },
    ],
    default: [
      { name: 'Amazon Basics Premium Quality Product', searchQuery: msg.slice(0, 40), price: 2999, platform: 'Amazon', rating: 4.4, pickType: 'Safe', deliveryEstimate: 'Tomorrow', whyThis: 'A highly reliable, top-rated pick that consistently delivers quality and value for money.' },
      { name: 'boAt / Noise Budget Alternative', searchQuery: msg.slice(0, 40), price: 1299, platform: 'Flipkart', rating: 4.2, pickType: 'Value', deliveryEstimate: '2–3 days', whyThis: 'Best value for money option in this segment, popular among Indian buyers for its reliability.' },
      { name: 'Premium Surprise Pick', searchQuery: msg.slice(0, 40), price: 4999, platform: 'Amazon', rating: 4.7, pickType: 'Surprise', deliveryEstimate: '2–3 days', whyThis: 'A lesser-known but highly-reviewed option that offers something unique compared to mainstream choices.' },
    ],
  };

  const isEarphone = /earphone|earbuds|headphone|headset|neckband/i.test(msg);
  const isCover    = /cover|case|back cover|phone case/i.test(msg);
  const isSkincare = /serum|moisturizer|face wash|sunscreen|toner|skincare|skin/i.test(msg);

  const products = isEarphone ? mockSets.earphone
    : isCover    ? mockSets.phone_cover
    : isSkincare ? mockSets.skincare
    : mockSets.default;

  return {
    reply: "Here are my top 3 picks for you — curated across the best platforms!",
    context: { platforms, budget: null },
    products: products.map((p, i) => ({
      ...p,
      id: `mock-${Date.now()}-${i}`,
      imageUrl: getPlaceholderImage(p.name, p.pickType),
      url: getSearchUrl(p.platform, p.searchQuery),
    })),
  };
}

// ─── Main API Route ──────────────────────────────────────────────────────────
export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { messages, context } = body;

  // ── Path A: Real Amazon PA-API (when keys are present) ──────────────────
  if (isAmazonConfigured()) {
    try {
      // Still use AI to interpret intent and get product suggestions
      const { object } = await generateObject({
        model: google('gemini-1.5-flash'),
        system: SYSTEM_PROMPT,
        messages: messages.filter(m => m.content).map(m => ({ role: m.role, content: String(m.content) })),
        schema: ResponseSchema,
      });

      // If AI wants to ask a clarifying question, return early
      if (!object.products || object.products.length === 0) {
        return NextResponse.json({ reply: object.reply, context, products: [] });
      }

      // Fetch real Amazon products for each AI suggestion in parallel
      const enriched = await Promise.all(
        object.products.map(async (p) => {
          try {
            if (p.platform === 'Amazon') {
              const results = await searchAmazon(p.searchQuery);
              const real = results[0];
              if (real) {
                return {
                  ...p,
                  id: `amz-${Date.now()}-${Math.random()}`,
                  name: real.name,
                  price: real.price || p.price,
                  imageUrl: real.imageUrl || getPlaceholderImage(p.name, p.pickType),
                  url: real.url,
                };
              }
            }
            // Non-Amazon platforms: use smart search links
            return {
              ...p,
              id: `smart-${Date.now()}-${Math.random()}`,
              imageUrl: getPlaceholderImage(p.name, p.pickType),
              url: getSearchUrl(p.platform, p.searchQuery),
            };
          } catch {
            return {
              ...p,
              id: `fallback-${Date.now()}-${Math.random()}`,
              imageUrl: getPlaceholderImage(p.name, p.pickType),
              url: getSearchUrl(p.platform, p.searchQuery),
            };
          }
        })
      );

      const finalContext = { ...context, platforms: object.updatedContext.platforms, budget: object.updatedContext.budget || context?.budget };
      return NextResponse.json({ reply: object.reply, context: finalContext, products: enriched });

    } catch (err) {
      console.error('[Kartify] PA-API path failed:', err?.message);
      // Fall through to AI-only path
    }
  }

  // ── Path B: Gemini AI with Smart Search Links (no PA-API) ────────────────
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    try {
      const { object } = await generateObject({
        model: google('gemini-1.5-flash'),
        system: SYSTEM_PROMPT,
        messages: messages.filter(m => m.content).map(m => ({ role: m.role, content: String(m.content) })),
        schema: ResponseSchema,
      });

      const finalContext = { ...context, platforms: object.updatedContext.platforms, budget: object.updatedContext.budget || context?.budget };

      const productsWithLinks = (object.products || []).map((p, i) => ({
        ...p,
        id: `ai-${Date.now()}-${i}`,
        imageUrl: getPlaceholderImage(p.name, p.pickType),
        url: getSearchUrl(p.platform, p.searchQuery),
      }));

      return NextResponse.json({ reply: object.reply, context: finalContext, products: productsWithLinks });

    } catch (err) {
      console.error('[Kartify] Gemini path failed:', err?.message);
    }
  }

  // ── Path C: Intelligent Mock Fallback (no API keys at all) ───────────────
  console.warn('[Kartify] No API keys configured — using smart mock fallback.');
  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')?.content || '';
  const mock = buildSmartMockProducts(lastUserMsg);
  return NextResponse.json({ reply: mock.reply, context: mock.context, products: mock.products });
}
