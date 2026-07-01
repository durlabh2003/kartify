import { Product, DummyJSONResponse, DummyJSONProduct } from '../types/product';

const DUMMY_JSON_URL = 'https://dummyjson.com/products';

// Helper to map DummyJSON products to our unified Product type
const mapToProduct = (p: DummyJSONProduct): Product => ({
  id: p.id.toString(),
  title: p.title,
  description: p.description,
  price: p.price,
  imageUrl: p.thumbnail, // thumbnail is usually higher quality/single image
  rating: p.rating,
  category: p.category,
  brand: p.brand,
});

export const productService = {
  /**
   * Search products by a general query string
   */
  async searchProducts(query: string, limit = 5): Promise<Product[]> {
    try {
      const res = await fetch(`${DUMMY_JSON_URL}/search?q=${encodeURIComponent(query)}&limit=${limit}`);
      if (!res.ok) throw new Error('Failed to fetch products');
      
      const data: DummyJSONResponse = await res.json();
      return data.products.map(mapToProduct);
    } catch (error) {
      console.error('Error in searchProducts:', error);
      return [];
    }
  },

  /**
   * Fetch products by specific category
   */
  async getProductsByCategory(category: string, limit = 5): Promise<Product[]> {
    try {
      const res = await fetch(`${DUMMY_JSON_URL}/category/${encodeURIComponent(category)}?limit=${limit}`);
      if (!res.ok) throw new Error('Failed to fetch products by category');
      
      const data: DummyJSONResponse = await res.json();
      return data.products.map(mapToProduct);
    } catch (error) {
      console.error('Error in getProductsByCategory:', error);
      return [];
    }
  },
  
  /**
   * Complex query combining search and potential category mapping
   * (In a real app, this might use SerpApi, but here we fall back to general search)
   */
  async findRecommendations(intent: { search?: string, category?: string, eligible_platforms?: string[] }): Promise<Product[]> {
    let rawProducts: Product[] = [];
    
    if (intent.search) {
      rawProducts = await this.searchProducts(intent.search, 10);
    } else if (intent.category) {
      rawProducts = await this.getProductsByCategory(intent.category, 10);
    } else {
      rawProducts = await this.getProductsByCategory('laptops', 10);
    }

    // Auto-determine eligible platforms based on product/query category if not provided
    let platforms = intent.eligible_platforms;
    if (!platforms || platforms.length === 0) {
      const queryText = ((intent.search || intent.category || '')).toLowerCase();
      if (queryText.includes('phone') || queryText.includes('laptop') || queryText.includes('electronics') || queryText.includes('audio') || queryText.includes('watch') || queryText.includes('tech')) {
        platforms = ['Amazon', 'Flipkart'];
      } else if (queryText.includes('skincare') || queryText.includes('beauty') || queryText.includes('makeup') || queryText.includes('perfume') || queryText.includes('fragrance')) {
        platforms = ['Nykaa', 'Amazon'];
      } else if (queryText.includes('shoe') || queryText.includes('shirt') || queryText.includes('dress') || queryText.includes('wear') || queryText.includes('bag') || queryText.includes('fashion') || queryText.includes('clothing')) {
        platforms = ['Myntra', 'Flipkart', 'Amazon', 'Meesho'];
      } else {
        platforms = ['Amazon', 'Flipkart', 'Meesho'];
      }
    }

    // Map raw products to include platform and pick type
    const pickTypes = ['Safe', 'Value', 'Surprise'];
    
    return rawProducts.slice(0, 3).map((p, idx) => {
      const platform = platforms[idx % platforms.length];
      const pickType = pickTypes[idx % pickTypes.length];
      let whyThis = `Highly rated ${p.brand || 'premium'} option selected for you.`;
      if (pickType === 'Safe') {
        whyThis = `Top-rated and highly reliable choice from ${p.brand || 'trusted brand'} with ${p.rating}★ rating on ${platform}.`;
      } else if (pickType === 'Value') {
        whyThis = `Best value-for-money option offering premium features at just $${p.price} on ${platform}.`;
      } else if (pickType === 'Surprise') {
        whyThis = `A unique and popular choice. ${p.description.slice(0, 80)}... available on ${platform}.`;
      }

      return {
        ...p,
        platform,
        pickType,
        whyThis,
      };
    });
  }
};
