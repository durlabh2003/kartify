'use client';

import React, { useState } from 'react';
import { RecommendationChat } from '../components/RecommendationChat';
import ProfileDrawer from '../components/ProfileDrawer';
import { ToastProvider } from '../components/ToastProvider';
import { User, Sparkles } from 'lucide-react';

export default function Home() {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  // using Vercel AI SDK useChat internally in RecommendationChat now

  return (
    <ToastProvider>
      <div className="flex flex-col h-screen w-full bg-white">

      {/* ── Header ── */}
      <header className="bg-white border-b border-slate-100 px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between z-20 sticky top-0 shadow-sm flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-700 text-white flex items-center justify-center font-extrabold text-lg shadow-md shadow-indigo-200 select-none">
            K
          </div>
          <div>
            <h1 className="font-bold text-base text-slate-900 tracking-tight leading-none">Kartify</h1>
            <p className="text-[10px] text-slate-400 font-medium">AI Shopping Assistant</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Live indicator */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-50 rounded-full border border-green-100">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            <span className="text-[11px] font-semibold text-green-700">AI Active</span>
          </div>

          {/* Profile button */}
          <button
            id="profile-btn"
            onClick={() => setIsProfileOpen(true)}
            className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-all"
            title="Saved Items"
          >
            <User size={19} />
          </button>
        </div>
      </header>

      {/* ── Chat Area — fills remaining height, scrolls internally ── */}
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-900 items-center justify-center py-4">
        <RecommendationChat />
      </div>

      {/* ── Profile Drawer ── */}
      <ProfileDrawer isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
      </div>
    </ToastProvider>
  );
}
