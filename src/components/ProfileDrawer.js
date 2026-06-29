'use client';
import React, { useState, useEffect } from 'react';
import { X, Heart, ExternalLink, Trash2, Inbox } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from './ToastProvider';

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
    const map = { Safe: 'bg-blue-100 text-blue-700', Value: 'bg-green-100 text-green-700', Surprise: 'bg-purple-100 text-purple-700' };
    return map[type] || 'bg-slate-100 text-slate-600';
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-sm bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Heart size={17} className="text-red-500 fill-red-500" />
              Saved Items
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">{likedProducts.length} product{likedProducts.length !== 1 ? 's' : ''} saved</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-24 rounded-xl shimmer" />
              ))}
            </div>
          ) : likedProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-16">
              <Inbox size={40} className="text-slate-200 mb-4" />
              <p className="font-semibold text-slate-500">Nothing saved yet</p>
              <p className="text-sm text-slate-400 mt-1 max-w-[200px]">Tap the ♥ on any product recommendation to save it here.</p>
            </div>
          ) : (
            likedProducts.map((product) => (
              <div key={product.id} className="flex gap-3 p-3 bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                <img
                  src={product.image_url || `https://placehold.co/80x80/EEF2FF/4F46E5?text=K`}
                  alt={product.product_name}
                  className="w-16 h-16 object-cover rounded-xl bg-slate-100 flex-shrink-0"
                  onError={(e) => { e.target.src = 'https://placehold.co/80x80/EEF2FF/4F46E5?text=K'; }}
                />
                <div className="flex flex-col flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-slate-800 line-clamp-2 leading-snug">{product.product_name}</h4>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-sm font-bold text-slate-900">₹{Number(product.price).toLocaleString('en-IN')}</span>
                    {product.pick_type && (
                      <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-md ${getBadgeColor(product.pick_type)}`}>
                        {product.pick_type}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-auto pt-1.5">
                    <span className="text-xs text-slate-400 font-medium">{product.platform}</span>
                    <button
                      onClick={() => handleDelete(product.id)}
                      className="p-1 text-slate-300 hover:text-red-400 transition-colors rounded-md hover:bg-red-50"
                      title="Remove"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer nudge */}
        <div className="p-4 border-t border-slate-100 bg-slate-50">
          <p className="text-xs text-slate-400 text-center leading-relaxed">
            Sign up coming soon to sync your saves across devices!
          </p>
        </div>
      </div>
    </>
  );
}
