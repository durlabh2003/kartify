'use client';
import React, { useState, useEffect } from 'react';
import { X, Heart, ExternalLink, Trash2, Inbox, UserPlus, History } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from './ToastProvider';
import { getSearchUrl } from '../lib/smart-links';

export default function ProfileDrawer({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('saved'); // 'saved' | 'recipients' | 'history'
  const [likedProducts, setLikedProducts] = useState([]);
  const [savedRecipients, setSavedRecipients] = useState([]);
  const [searchHistory, setSearchHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const { addToast } = useToast();

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
    };
    fetchUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchLikedProducts();
      loadData();
    }
  }, [isOpen, user]);

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

  const loadData = async () => {
    if (user) {
      try {
        const { data: recipientsData, error: errRec } = await supabase
          .from('saved_recipients')
          .select('*')
          .order('created_at', { ascending: false });
        
        const { data: historyData, error: errHist } = await supabase
          .from('search_history')
          .select('*')
          .order('created_at', { ascending: false });

        if (recipientsData && !errRec) setSavedRecipients(recipientsData);
        if (historyData && !errHist) {
          setSearchHistory(historyData.map((h) => ({
            id: h.id,
            query: h.query,
            date: new Date(h.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
          })));
        }
      } catch (e) {
        console.error('Supabase load error:', e);
      }
    } else {
      try {
        const history = JSON.parse(localStorage.getItem('kartify_search_history') || '[]');
        const recipients = JSON.parse(localStorage.getItem('kartify_saved_recipients') || '[]');
        setSearchHistory(history);
        setSavedRecipients(recipients);
      } catch (e) {
        console.error('Local data load error:', e);
      }
    }
  };

  const handleDeleteLiked = async (id) => {
    try {
      const { error } = await supabase.from('liked_products').delete().eq('id', id);
      if (error) throw error;
      setLikedProducts(prev => prev.filter(p => p.id !== id));
      addToast('Removed from saved items', 'info');
    } catch {
      addToast('Could not remove item', 'error');
    }
  };

  const handleDeleteRecipient = async (id) => {
    try {
      if (user) {
        const { error } = await supabase.from('saved_recipients').delete().eq('id', id);
        if (error) throw error;
        setSavedRecipients(prev => prev.filter(r => r.id !== id));
      } else {
        const filtered = savedRecipients.filter(r => r.id !== id);
        localStorage.setItem('kartify_saved_recipients', JSON.stringify(filtered));
        setSavedRecipients(filtered);
      }
      addToast('Removed recipient profile', 'info');
    } catch (e) {
      addToast('Could not remove recipient', 'error');
    }
  };

  const handleDeleteHistory = async (id) => {
    try {
      if (user) {
        const { error } = await supabase.from('search_history').delete().eq('id', id);
        if (error) throw error;
        setSearchHistory(prev => prev.filter(h => h.id !== id));
      } else {
        const filtered = searchHistory.filter(h => h.id !== id);
        localStorage.setItem('kartify_search_history', JSON.stringify(filtered));
        setSearchHistory(filtered);
      }
      addToast('Removed search history item', 'info');
    } catch (e) {
      addToast('Could not remove search', 'error');
    }
  };

  const triggerSearch = (query) => {
    window.dispatchEvent(new CustomEvent('kartify_trigger_search', { detail: query }));
    onClose();
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
        <div className="flex items-center justify-between p-5 border-b border-white/5 pb-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              My Kartify
            </h2>
            <p className="text-xs text-white/50 mt-1">Manage profile, recipients, & searches</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/5 rounded-full transition-colors text-white/70 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex bg-slate-950/40 p-1 border-b border-white/5 text-xs font-semibold">
          {[
            { id: 'saved', label: 'Saved Items', icon: Heart },
            { id: 'recipients', label: 'Recipients', icon: UserPlus },
            { id: 'history', label: 'History', icon: History }
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 rounded-xl transition-all ${
                  active 
                    ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/10' 
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon size={12} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          
          {/* TAB 1: SAVED ITEMS */}
          {activeTab === 'saved' && (
            loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-24 rounded-xl bg-white/5 animate-pulse" />
                ))}
              </div>
            ) : likedProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-16">
                <Inbox size={36} className="text-white/20 mb-4 animate-bounce" />
                <p className="font-semibold text-white/70 text-sm">Nothing saved yet</p>
                <p className="text-[11px] text-white/40 mt-1 max-w-[200px]">Tap the ♥ on any product recommendation to save it here.</p>
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
                          onClick={() => handleDeleteLiked(product.id)}
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
            )
          )}

          {/* TAB 2: SAVED RECIPIENTS */}
          {activeTab === 'recipients' && (
            savedRecipients.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-16">
                <UserPlus size={36} className="text-white/20 mb-4" />
                <p className="font-semibold text-white/70 text-sm">No saved recipients</p>
                <p className="text-[11px] text-white/40 mt-1 max-w-[200px]">Profiles are automatically saved when you query gifts for family or friends.</p>
              </div>
            ) : (
              savedRecipients.map((recipient) => (
                <div 
                  key={recipient.id} 
                  className="p-3.5 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between hover:border-emerald-500/30 hover:bg-emerald-500/[0.02] cursor-pointer group transition-all"
                  onClick={() => triggerSearch(`Find a birthday gift for my ${recipient.relation}`)}
                >
                  <div>
                    <h4 className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">{recipient.name} ({recipient.relation})</h4>
                    <p className="text-xs text-white/45 mt-0.5">Prefers: {recipient.interests}</p>
                  </div>
                  <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => handleDeleteRecipient(recipient.id)}
                      className="p-1.5 text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      title="Delete profile"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))
            )
          )}

          {/* TAB 3: SEARCH HISTORY */}
          {activeTab === 'history' && (
            searchHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-16">
                <History size={36} className="text-white/20 mb-4" />
                <p className="font-semibold text-white/70 text-sm">Search history empty</p>
                <p className="text-[11px] text-white/40 mt-1 max-w-[200px]">Your recent searches will appear here. Tap any item to run it again.</p>
              </div>
            ) : (
              searchHistory.map((item) => (
                <div 
                  key={item.id} 
                  className="p-3 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between hover:border-emerald-500/30 hover:bg-emerald-500/[0.02] cursor-pointer group transition-all"
                  onClick={() => triggerSearch(item.query)}
                >
                  <div className="min-w-0 flex-1 pr-3">
                    <p className="text-xs font-semibold text-white/80 group-hover:text-emerald-400 transition-colors truncate">{item.query}</p>
                    <span className="text-[9px] text-white/30 font-semibold block mt-0.5">{item.date}</span>
                  </div>
                  <div className="flex items-center" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => handleDeleteHistory(item.id)}
                      className="p-1.5 text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      title="Delete history item"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))
            )
          )}

        </div>

        {/* Footer nudge */}
        <div className="p-4 border-t border-white/5 bg-slate-950">
          <p className="text-[10px] text-white/40 text-center leading-relaxed">
            Sync saved items & search patterns across all devices!
          </p>
        </div>
      </div>
    </>
  );
}
