import { NextRequest } from 'next/server';
import { supabase } from '../supabase';

export interface AuthenticatedRequest extends NextRequest {
  user?: any;
}

/**
 * Verifies the Supabase JWT token from the Authorization header.
 * Usage: Call this helper inside Next.js API Routes to protect them.
 * 
 * @param req NextRequest
 * @returns { user, error }
 */
export async function verifyAuth(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { user: null, error: 'Missing or malformed Authorization header' };
  }

  const token = authHeader.split(' ')[1];
  
  // Call supabase auth helper to verify and get user
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return { user: null, error: error?.message || 'Invalid authentication token' };
  }

  return { user, error: null };
}
