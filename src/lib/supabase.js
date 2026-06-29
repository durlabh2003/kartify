import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Guard: only create the client if both keys are present
let _supabase = null;

function getSupabase() {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[Kartify] Supabase env vars missing. Supabase features disabled.');
    return null;
  }
  if (!_supabase) {
    _supabase = createClient(supabaseUrl, supabaseAnonKey);
  }
  return _supabase;
}

// Named export that is always safe to call
export const supabase = {
  from: (table) => {
    const client = getSupabase();
    if (!client) {
      // Return a no-op proxy so callers don't crash
      const noop = () => Promise.resolve({ data: [], error: null });
      return { select: () => ({ order: () => ({ data: [], error: null }) }), insert: noop, delete: () => ({ eq: noop }) };
    }
    return client.from(table);
  },
};

