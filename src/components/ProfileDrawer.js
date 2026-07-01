'use client';
import React, { useState, useEffect } from 'react';
import { X, Heart, ExternalLink, Trash2, Inbox } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from './ToastProvider';
import { getSearchUrl } from '../lib/smart-links';

export default function ProfileDrawer({ isOpen, onClose }) {
  const [likedProducts, setLikedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();

  useEffect(() => {
    if (isOpen) fetchLikedProducts();
  }, [isOpen]);

  const fetchLikedProducts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('liked_products')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setLikedProducts(data || []);
    } catch (err) {
      console.error('Fetch failed:', err);
      addToast('Could not load saved items. Check Supabase setup.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      const { error } = await supabase.from('liked_products').delete().eq('id', id);
      if (error) throw error;
      setLikedProducts(prev => prev.filter(p => p.id !== id));
      addToast('Removed from saved items', 'info');
    } catch {
      addToast('Could not remove item', 'error');
    }
  };

  const getBadgeColor = (type) => {
    const map = { 
      Safe: 'bg-blue-500/20 text-blue-300 border border-blue-500/30', 
      Value: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30', 
      Surprise: 'bg-purple-500/20 text-purple-300 border border-purple-500/30' 
    };
    return map[type] || 'bg-slate-800 text-slate-400 border border-slate-700';
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-sm bg-slate-900 border-l border-white/10 shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Heart size={17} className="text-red-500 fill-red-500" />
              Saved Items
            </h2>
            <p className="text-xs text-white/50 mt-1">{likedProducts.length} product{likedProducts.length !== 1 ? 's' : ''} saved</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/5 rounded-full transition-colors text-white/70 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-24 rounded-xl bg-white/5 animate-pulse" />
              ))}
            </div>
          ) : likedProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-16">
              <Inbox size={40} className="text-white/20 mb-4" />
              <p className="font-semibold text-white/70">Nothing saved yet</p>
              <p className="text-xs text-white/40 mt-1 max-w-[200px]">Tap the ♥ on any product recommendation to save it here.</p>
            </div>
          ) : (
            likedProducts.map((product) => (
              <div key={product.id} className="flex gap-3 p-3 bg-white/5 border border-white/10 rounded-2xl shadow-sm hover:border-white/20 transition-all">
                <img
                  src={product.image_url || `https://placehold.co/80x80/22C55E/FFFFFF?text=K`}
                  alt={product.product_name}
                  className="w-16 h-16 object-contain rounded-xl bg-white p-1 flex-shrink-0"
                  onError={(e) => { e.target.src = 'https://placehold.co/80x80/22C55E/FFFFFF?text=K'; }}
                />
                <div className="flex flex-col flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-white line-clamp-1 leading-snug">{product.product_name}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm font-bold text-emerald-400">${product.price}</span>
                    {product.pick_type && (
                      <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${getBadgeColor(product.pick_type)}`}>
                        {product.pick_type}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-auto pt-1.5">
                    <span className="text-[10px] text-white/40 font-semibold uppercase">{product.platform}</span>
                    <div className="flex items-center gap-2">
                      <a 
                        href={getSearchUrl(product.platform || 'Amazon', product.product_name)}
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="p-1 text-white/50 hover:text-emerald-400 transition-colors"
                        title="View Link"
                      >
                        <ExternalLink size={12} />
                      </a>
                      <button
                        onClick={() => handleDelete(product.id)}
                        className="p-1 text-white/40 hover:text-red-400 transition-colors rounded-md hover:bg-red-500/10"
                        title="Remove"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer nudge */}
        <div className="p-4 border-t border-white/5 bg-slate-950">
          <p className="text-xs text-white/40 text-center leading-relaxed">
            Sync your saves across all devices automatically!
          </p>
        </div>
      </div>
    </>
  );
}
