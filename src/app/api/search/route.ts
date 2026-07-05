import { NextResponse } from 'next/server';
import { productService } from '../../../lib/services/productService';

export async function POST(req: Request) {
  try {
    const { summary } = await req.json();
    
    if (!summary) {
      return NextResponse.json({ error: 'Summary is required' }, { status: 400 });
    }

    console.log(`[API Search Proxy] Searching products for summary: \"${summary}\"`);
    const products = await productService.findRecommendations({ summary });
    
    return NextResponse.json(products);
  } catch (error: any) {
    console.error('[API Search Proxy] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch recommendations' }, { status: 500 });
  }
}
