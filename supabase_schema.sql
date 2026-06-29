-- Copy and paste this into the Supabase SQL Editor to create your liked_products table

CREATE TABLE IF NOT EXISTS public.liked_products (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  product_name text NOT NULL,
  price numeric NOT NULL,
  platform text NOT NULL,
  rating numeric,
  image_url text,
  pick_type text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Optional: If you want to enable Row Level Security (RLS) and allow anonymous users to insert/select (for MVP purposes)
ALTER TABLE public.liked_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public select" ON public.liked_products FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON public.liked_products FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete" ON public.liked_products FOR DELETE USING (true);
