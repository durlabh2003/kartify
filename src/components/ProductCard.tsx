'use client';

import { Product } from '../lib/types/product';
import { Heart, Star, ExternalLink, ShieldCheck, BadgePercent, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { getSearchUrl, getPlaceholderImage } from '../lib/smart-links';

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
            platform: product.platform || 'Amazon',
            rating: product.rating,
            image_url: product.imageUrl || getPlaceholderImage(product.title, product.pickType || 'Safe'),
            pick_type: product.pickType || 'Safe',
          },
        ]);
        if (error) throw error;
        setIsLiked(true);
      } else {
        setIsLiked(false);
      }
    } catch (error) {
      console.error('Error saving liked product:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const getPlatformStyle = (platform?: string) => {
    switch (platform) {
      case 'Amazon':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'Flipkart':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'Myntra':
        return 'bg-pink-500/20 text-pink-300 border-pink-500/30';
      case 'Nykaa':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
      case 'Meesho':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      default:
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    }
  };

  const getPickTypeBadge = (pickType?: string) => {
    switch (pickType) {
      case 'Safe':
        return (
          <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
            <ShieldCheck size={11} /> Safe Pick
          </span>
        );
      case 'Value':
        return (
          <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            <BadgePercent size={11} /> Value Pick
          </span>
        );
      case 'Surprise':
        return (
          <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
            <Sparkles size={11} /> Surprise Pick
          </span>
        );
      default:
        return null;
    }
  };

  const buyUrl = product.url || getSearchUrl(product.platform || 'Amazon', product.title);
  const displayImage = product.imageUrl || getPlaceholderImage(product.title, product.pickType || 'Safe');

  return (
    <motion.div 
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-4 flex flex-col gap-4 relative group hover:border-white/20 transition-all duration-300 w-full max-w-[280px]"
    >
      {/* Save Button */}
      <button 
        onClick={handleLike}
        disabled={isSaving}
        className="absolute top-6 right-6 z-10 p-2.5 rounded-full bg-black/60 backdrop-blur-md hover:bg-black/80 border border-white/10 transition-colors"
      >
        <Heart 
          size={16} 
          className={`transition-colors ${isLiked ? 'fill-red-500 text-red-500' : 'text-white/80 group-hover:text-white'}`} 
        />
      </button>

      {/* Image Showcase */}
      <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-white/90 p-4 flex items-center justify-center">
        <img 
          src={displayImage} 
          alt={product.title}
          className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-500"
          onError={(e: any) => {
            e.target.src = getPlaceholderImage(product.title, product.pickType || 'Safe');
          }}
        />
      </div>

      {/* Product Information */}
      <div className="flex flex-col flex-1 gap-2.5">
        <div className="flex items-center justify-between gap-2">
          {getPickTypeBadge(product.pickType)}
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${getPlatformStyle(product.platform)}`}>
            {product.platform || 'Amazon'}
          </span>
        </div>

        <div>
          <h3 className="text-white font-semibold line-clamp-1 text-sm group-hover:text-emerald-400 transition-colors" title={product.title}>
            {product.title}
          </h3>
          <span className="text-emerald-400 font-extrabold text-base block mt-0.5">
            ₹{product.price.toLocaleString('en-IN')}
          </span>
        </div>

        {product.whyThis && (
          <div className="bg-white/5 border border-white/5 rounded-xl p-2.5 text-xs text-white/70 leading-relaxed italic">
            <span className="font-semibold text-emerald-400 not-italic block mb-0.5">Why this?</span>
            "{product.whyThis}"
          </div>
        )}

        <p className="text-white/40 text-xs line-clamp-2 leading-relaxed">
          {product.description}
        </p>
        
        <div className="flex items-center justify-between mt-auto pt-2 border-t border-white/5">
          <div className="flex items-center gap-1">
            <Star size={13} className="fill-amber-400 text-amber-400" />
            <span className="text-white/80 text-xs font-semibold">{product.rating}</span>
          </div>
          <a
            href={buyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs rounded-full shadow-lg shadow-emerald-500/10 transition-colors"
          >
            Buy Now <ExternalLink size={11} />
          </a>
        </div>
      </div>
    </motion.div>
  );
}
