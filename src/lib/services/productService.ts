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
  async findRecommendations(intent: { search?: string, category?: string }): Promise<Product[]> {
    // If we have a specific category, we might prioritize that, 
    // but for DummyJSON, a generic search usually works best if search term exists.
    if (intent.search) {
      return this.searchProducts(intent.search);
    } else if (intent.category) {
      return this.getProductsByCategory(intent.category);
    }
    
    // Fallback: return top rated laptops or something if no intent
    return this.getProductsByCategory('laptops');
  }
};
