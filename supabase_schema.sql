-- Copy and paste this into the Supabase SQL Editor to create your database tables and configure Row Level Security (RLS)

-- 1. Liked Products Table
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

ALTER TABLE public.liked_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public select" ON public.liked_products FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON public.liked_products FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete" ON public.liked_products FOR DELETE USING (true);

-- 2. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name text,
  phone text UNIQUE,
  city text,
  pincode text,
  preferred_platforms text[], -- Array: ['Amazon', 'Flipkart']
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Saved Recipients Table
CREATE TABLE IF NOT EXISTS public.saved_recipients (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  relation text NOT NULL, -- e.g., 'Mom', 'Brother'
  interests text, -- e.g., 'Skincare, Books'
  age_group text, -- e.g., '20-30', '50-60'
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Search History Table (Last 10 limit enforced via trigger)
CREATE TABLE IF NOT EXISTS public.search_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  query text NOT NULL,
  occasion text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Selection Pattern Learning Table
CREATE TABLE IF NOT EXISTS public.selection_patterns (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  category text NOT NULL,
  pick_type text NOT NULL, -- 'Safe' | 'Value' | 'Surprise'
  price numeric NOT NULL,
  brand_tier text NOT NULL, -- 'Premium' | 'Mainstream' | 'D2C' | 'Unbranded'
  platform text NOT NULL,
  interacted_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS) Policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.selection_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only read/write their own profile" 
  ON public.profiles FOR ALL USING (auth.uid() = id);

CREATE POLICY "Users can only manage their own saved recipients" 
  ON public.saved_recipients FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can only manage their own search history" 
  ON public.search_history FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can only manage their own selection patterns" 
  ON public.selection_patterns FOR ALL USING (auth.uid() = user_id);

-- Enforce maximum of 10 search history logs per user using a trigger
CREATE OR REPLACE FUNCTION limit_search_history_per_user()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.search_history
  WHERE id IN (
    SELECT id
    FROM public.search_history
    WHERE user_id = NEW.user_id
    ORDER BY created_at DESC
    OFFSET 10
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_limit_search_history
AFTER INSERT ON public.search_history
FOR EACH ROW
EXECUTE FUNCTION limit_search_history_per_user();
