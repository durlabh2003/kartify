'use client';

import React, { useState } from 'react';
import { RecommendationChat } from '../components/RecommendationChat';
import ProfileDrawer from '../components/ProfileDrawer';
import { ToastProvider } from '../components/ToastProvider';
import { User, Sparkles } from 'lucide-react';

export default function Home() {
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  return (
    <ToastProvider>
      <div className="flex flex-col h-screen w-full bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500/30 selection:text-emerald-300">

      {/* ── Premium Dark Header ── */}
      <header className="bg-slate-900/60 backdrop-blur-xl border-b border-white/5 px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between z-20 sticky top-0 shadow-lg flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 text-slate-950 flex items-center justify-center font-extrabold text-xl shadow-lg shadow-emerald-500/20 select-none">
            K
          </div>
          <div>
            <h1 className="font-bold text-base text-white tracking-tight leading-none">Kartify</h1>
            <p className="text-[10px] text-white/50 font-semibold tracking-wide mt-1 uppercase">AI Shopping Assistant</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Live indicator */}
          <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 rounded-full border border-emerald-500/20">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-[10px] font-bold tracking-wider uppercase text-emerald-400">AI Active</span>
          </div>

          {/* Profile / Saved Items button */}
          <button
            id="profile-btn"
            onClick={() => setIsProfileOpen(true)}
            className="p-2.5 text-white/70 hover:text-emerald-400 hover:bg-white/5 rounded-full border border-white/5 transition-all"
            title="Saved Items"
          >
            <User size={18} />
          </button>
        </div>
      </header>

      {/* ── Chat Area — fills remaining height, scrolls internally ── */}
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-950 items-center justify-center p-4">
        <RecommendationChat />
      </div>

      {/* ── Profile Drawer ── */}
      <ProfileDrawer isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
      </div>
    </ToastProvider>
  );
}
