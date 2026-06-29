/**
 * Amazon Product Advertising API (PA-API 5.0) Integration
 * 
 * This module is pre-built and ready to activate.
 * Simply add credentials to .env.local to enable real product search.
 * 
 * Required env vars:
 *   AMAZON_ACCESS_KEY
 *   AMAZON_SECRET_KEY
 *   AMAZON_ASSOCIATE_TAG
 *   AMAZON_REGION (default: ap-south-1 for amazon.in)
 */

import crypto from 'crypto';

const REGION = process.env.AMAZON_REGION || 'ap-south-1';
const HOST = `webservices.amazon.in`;
const ENDPOINT = `https://${HOST}/paapi5/searchitems`;

// Check if PA-API is fully configured
export function isAmazonConfigured() {
  return !!(
    process.env.AMAZON_ACCESS_KEY &&
    process.env.AMAZON_SECRET_KEY &&
    process.env.AMAZON_ASSOCIATE_TAG
  );
}

/**
 * Signs and sends a PA-API 5.0 SearchItems request.
 * Returns up to 3 formatted products.
 */
export async function searchAmazon(searchQuery, category = 'All') {
  if (!isAmazonConfigured()) {
    throw new Error('Amazon PA-API credentials not configured');
  }

  const payload = JSON.stringify({
    Keywords: searchQuery,
    Resources: [
      'Images.Primary.Large',
      'ItemInfo.Title',
      'Offers.Listings.Price',
      'ItemInfo.Features',
    ],
    PartnerTag: process.env.AMAZON_ASSOCIATE_TAG,
    PartnerType: 'Associates',
    Marketplace: 'www.amazon.in',
    SearchIndex: category,
    ItemCount: 3,
  });

  const timestamp = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const date = timestamp.slice(0, 8);

  // AWS Signature Version 4
  const headers = {
    'content-encoding': 'amz-1.0',
    'content-type': 'application/json; charset=utf-8',
    host: HOST,
    'x-amz-date': timestamp,
    'x-amz-target': 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems',
  };

  const canonicalHeaders = Object.entries(headers)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v}`)
    .join('\n') + '\n';

  const signedHeaders = Object.keys(headers).sort().join(';');
  const payloadHash = crypto.createHash('sha256').update(payload).digest('hex');
  const canonicalRequest = ['POST', '/paapi5/searchitems', '', canonicalHeaders, signedHeaders, payloadHash].join('\n');

  const credentialScope = `${date}/${REGION}/ProductAdvertisingAPI/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', timestamp, credentialScope, crypto.createHash('sha256').update(canonicalRequest).digest('hex')].join('\n');

  const hmac = (key, data) => crypto.createHmac('sha256', key).update(data).digest();
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${process.env.AMAZON_SECRET_KEY}`, date), REGION), 'ProductAdvertisingAPI'), 'aws4_request');
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');

  const authHeader = `AWS4-HMAC-SHA256 Credential=${process.env.AMAZON_ACCESS_KEY}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { ...headers, Authorization: authHeader },
    body: payload,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`PA-API error: ${response.status} — ${err}`);
  }

  const data = await response.json();
  const items = data?.SearchResult?.Items || [];

  return items.map(item => ({
    name: item.ItemInfo?.Title?.DisplayValue || 'Unknown Product',
    price: item.Offers?.Listings?.[0]?.Price?.Amount || 0,
    imageUrl: item.Images?.Primary?.Large?.URL || null,
    url: item.DetailPageURL || '#',
    platform: 'Amazon',
    rating: 4.3, // PA-API v5 doesn't return ratings directly
  }));
}
