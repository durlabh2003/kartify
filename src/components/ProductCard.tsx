'use client';

import { Product } from '@/lib/types/product';
import { Heart, Star } from 'lucide-react';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client lazily or pass via context/props in a real app
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const [isLiked, setIsLiked] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleLike = async () => {
    if (!supabase) {
      console.warn('Supabase not configured');
      setIsLiked(!isLiked); // Optimistic UI update even if no DB
      return;
    }

    setIsSaving(true);
    try {
      if (!isLiked) {
        // Save to DB
        const { error } = await supabase.from('liked_products').insert([
          {
            product_name: product.title,
            price: product.price,
            platform: 'DummyJSON', // Fallback since we aren't using real Amazon yet
            rating: product.rating,
            image_url: product.imageUrl,
            pick_type: 'AI_Recommendation',
          },
        ]);
        if (error) throw error;
        setIsLiked(true);
      } else {
        // In a full implementation, you'd delete it or toggle a state.
        // For now we'll just toggle the UI state.
        setIsLiked(false);
      }
    } catch (error) {
      console.error('Error saving liked product:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-4 flex flex-col gap-4 relative group"
    >
      <button 
        onClick={handleLike}
        disabled={isSaving}
        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/40 backdrop-blur-md hover:bg-black/60 transition-colors"
      >
        <Heart 
          size={18} 
          className={`transition-colors ${isLiked ? 'fill-red-500 text-red-500' : 'text-white'}`} 
        />
      </button>

      <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-white">
        {/* Using standard img instead of Next Image to avoid host configuration issues with random APIs */}
        <img 
          src={product.imageUrl} 
          alt={product.title}
          className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500 p-4"
        />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-start gap-2">
          <h3 className="text-white font-semibold line-clamp-2">{product.title}</h3>
          <span className="text-emerald-400 font-bold whitespace-nowrap">${product.price}</span>
        </div>
        
        <p className="text-white/50 text-sm line-clamp-2">{product.description}</p>
        
        <div className="flex items-center gap-1 mt-auto">
          <Star size={14} className="fill-yellow-500 text-yellow-500" />
          <span className="text-white/80 text-sm font-medium">{product.rating}</span>
        </div>
      </div>
    </motion.div>
  );
}
