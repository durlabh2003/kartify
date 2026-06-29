'use client';

import { useChat } from '@ai-sdk/react';
import { ProductCard } from './ProductCard';
import { Product } from '@/lib/types/product';
import { Send, Loader2, Sparkles, ShoppingBag } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export function RecommendationChat() {
  const chatContext = useChat({
    api: '/api/chat',
    maxSteps: 3,
  });
  
  const { messages, input, handleInputChange, handleSubmit, isLoading, setInput } = chatContext;
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-4xl mx-auto w-full bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="bg-white/5 border-b border-white/10 p-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
          <Sparkles className="text-emerald-400" size={20} />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-white">Kartify AI</h1>
          <p className="text-white/50 text-sm">Your personal shopping assistant</p>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8 scroll-smooth">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-50">
            <ShoppingBag size={48} className="text-white/50" />
            <h2 className="text-2xl text-white font-medium">What are you looking for?</h2>
            <p className="text-white/60 max-w-md">
              Ask me for recommendations, e.g., "I need a great budget laptop for college" or "Show me top rated wireless earbuds."
            </p>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((m) => (
            <motion.div 
              key={m.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'} gap-2`}
            >
              {/* Message Bubble */}
              {m.content && (
                <div 
                  className={`max-w-[85%] px-5 py-3 rounded-2xl ${
                    m.role === 'user' 
                      ? 'bg-emerald-500/20 text-emerald-50 border border-emerald-500/30 rounded-br-sm' 
                      : 'bg-white/10 text-white/90 border border-white/10 rounded-bl-sm'
                  }`}
                >
                  <div className="prose prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-black/50">
                    {m.content}
                  </div>
                </div>
              )}

              {/* Tool Invocations (Product Grids) */}
              {m.toolInvocations?.map((toolInvocation) => {
                if (toolInvocation.toolName === 'findProducts') {
                  if ('result' in toolInvocation) {
                    const products: Product[] = toolInvocation.result;
                    if (products.length === 0) return (
                      <div key={toolInvocation.toolCallId} className="text-white/50 italic text-sm mt-2">
                        No products found for that search.
                      </div>
                    );

                    return (
                      <div key={toolInvocation.toolCallId} className="w-full mt-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                          {products.map(product => (
                            <ProductCard key={product.id} product={product} />
                          ))}
                        </div>
                      </div>
                    );
                  } else {
                    return (
                      <div key={toolInvocation.toolCallId} className="flex items-center gap-2 text-white/50 bg-white/5 px-4 py-2 rounded-full text-sm w-fit mt-2 border border-white/10">
                        <Loader2 size={14} className="animate-spin" />
                        Searching database...
                      </div>
                    );
                  }
                }
                return null;
              })}
            </motion.div>
          ))}
        </AnimatePresence>
        
        {isLoading && messages[messages.length - 1]?.role === 'user' && (
          <div className="flex items-center gap-2 text-white/50 text-sm">
            <Loader2 size={16} className="animate-spin" />
            Thinking...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white/5 border-t border-white/10">
        <form 
          onSubmit={handleSubmit}
          className="relative flex items-center max-w-3xl mx-auto"
        >
          <input
            value={input || ''}
            onChange={(e) => {
              if (handleInputChange) {
                handleInputChange(e);
              } else if (setInput) {
                setInput(e.target.value);
              }
            }}
            placeholder="Type your request here..."
            className="w-full bg-black/40 border border-white/10 rounded-full px-6 py-4 pr-14 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input?.trim()}
            className="absolute right-2 p-3 bg-emerald-500 hover:bg-emerald-400 text-white rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
