'use client';
import React, { useRef, useEffect } from 'react';
import { useChatStore } from '../store/useChatStore';
import ProductCard from './ProductCard';
import { Bot, User, ShoppingBag } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
      <div className="w-16 h-16 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-3xl font-bold mb-4 shadow-lg shadow-indigo-200">
        K
      </div>
      <h2 className="text-lg font-bold text-slate-800 mb-2">Hi, I'm Kartify!</h2>
      <p className="text-sm text-slate-500 max-w-xs leading-relaxed">
        I'm your AI shopping assistant. Tell me what you're looking for and I'll find 3 perfect picks for you.
      </p>
      <div className="mt-6 grid grid-cols-2 gap-2 text-left w-full max-w-xs">
        {['🎮 Gaming setup', '💄 Skincare for oily skin', '🎁 Birthday gift for mom', '📱 Best mid-range phone'].map(ex => (
          <div key={ex} className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-600 font-medium">{ex}</div>
        ))}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex justify-start"
    >
      <div className="flex flex-row items-end gap-2">
        <div className="w-7 h-7 rounded-full bg-white shadow-sm text-indigo-600 border border-slate-200 flex items-center justify-center shrink-0">
          <Bot size={14} />
        </div>
        <div className="px-4 py-3 rounded-2xl rounded-bl-sm bg-white shadow-sm border border-slate-100 flex gap-1 items-center">
          {[0, 150, 300].map((delay) => (
            <div
              key={delay}
              className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

export default function ChatWindow() {
  const { messages, isLoading } = useChatStore();
  const bottomRef = useRef(null);
  const hasOnlyWelcome = messages.length === 1 && messages[0].id === 'welcome';

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  if (hasOnlyWelcome) {
    return <EmptyState />;
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-5 bg-slate-50">
      <AnimatePresence initial={false}>
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} gap-2`}
          >
            {/* Text bubble row (with avatar, constrained width) */}
            {msg.content && (
              <div className={`flex max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} items-end gap-2`}>
                {/* Avatar */}
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user'
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                    : 'bg-white shadow-sm text-indigo-600 border border-slate-200'}`}>
                  {msg.role === 'user' ? <User size={13} /> : <Bot size={13} />}
                </div>
                <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-br-sm shadow-sm shadow-indigo-100'
                    : 'bg-white shadow-sm border border-slate-100 text-slate-800 rounded-bl-sm'
                }`}>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            )}

            {/* Product cards — full-width horizontal scroll, NOT constrained */}
            {msg.products && msg.products.length > 0 && (
              <div className="w-full">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 pl-1 flex items-center gap-1">
                  <ShoppingBag size={11} /> {msg.products.length} picks for you
                </p>
                <div className="flex flex-row gap-3 overflow-x-auto pb-3 snap-x snap-mandatory hide-scrollbar -mx-4 px-4">
                  {msg.products.map((product, idx) => (
                    <div key={product.id || idx} className="snap-start shrink-0">
                      <ProductCard product={product} />
                    </div>
                  ))}
                  {/* Right padding sentinel */}
                  <div className="shrink-0 w-1" />
                </div>
              </div>
            )}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Typing indicator */}
      <AnimatePresence>
        {isLoading && <TypingIndicator />}
      </AnimatePresence>

      <div ref={bottomRef} className="h-2" />
    </div>
  );
}
