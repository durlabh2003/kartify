/**
 * Smart Search Link Generator
 * 
 * Generates real, working product search URLs for each platform
 * based on the AI's product recommendation.
 * 
 * This works TODAY with zero API keys.
 * When PA-API is enabled, these links are replaced by real product deep links.
 */

const PLATFORM_SEARCH_URLS = {
  Amazon:   (q) => `https://www.amazon.in/s?k=${encodeURIComponent(q)}`,
  Flipkart: (q) => `https://www.flipkart.com/search?q=${encodeURIComponent(q)}`,
  Myntra:   (q) => `https://www.myntra.com/search?rawQuery=${encodeURIComponent(q)}`,
  Nykaa:    (q) => `https://www.nykaa.com/search/result/?q=${encodeURIComponent(q)}&root=true`,
  Meesho:   (q) => `https://www.meesho.com/search?q=${encodeURIComponent(q)}`,
};

/**
 * Returns a working search URL for a given platform and product name.
 * Falls back to Amazon if platform is unknown.
 */
export function getSearchUrl(platform, productName) {
  const builder = PLATFORM_SEARCH_URLS[platform] || PLATFORM_SEARCH_URLS['Amazon'];
  return builder(productName);
}

/**
 * Generates a product image placeholder with the product name embedded.
 * Used as a fallback when no real image URL is available.
 */
export function getPlaceholderImage(productName, pickType) {
  const colors = {
    Safe:     { bg: '4F46E5', text: 'FFFFFF' },
    Value:    { bg: '059669', text: 'FFFFFF' },
    Surprise: { bg: '7C3AED', text: 'FFFFFF' },
  };
  const c = colors[pickType] || colors.Safe;
  const label = encodeURIComponent(productName?.slice(0, 25) || 'Product');
  return `https://placehold.co/300x200/${c.bg}/${c.text}?text=${label}`;
}
