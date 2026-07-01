'use client';

import { useChat } from '@ai-sdk/react';
import { ProductCard } from './ProductCard';
import { Product } from '../lib/types/product';
import { Send, Loader2, Sparkles, ShoppingBag, Gift, Laptop, Sparkle, ShieldAlert, Mic } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const QUICK_PROMPTS = [
  { label: '🎁 Gift for Dad', icon: Gift, query: 'Need a birthday gift for my Dad, budget around 3000 Rs' },
  { label: '💻 Coding Laptop', icon: Laptop, query: 'Best coding laptop for college student, under 60k' },
  { label: '✨ Skincare/Glow', icon: Sparkle, query: 'Skincare products for dry skin' },
  { label: '👟 Running Shoes', icon: ShoppingBag, query: 'Good running shoes for myself' }
];

export function RecommendationChat() {
  const chatContext = useChat();
  const { messages, sendMessage, status } = chatContext;
  const isLoading = status === 'submitted' || status === 'streaming';
  
  if (typeof window !== 'undefined') {
    (window as any).chatDebugMessages = messages;
    (window as any).chatDebugStatus = status;
    (window as any).chatDebugIsLoading = isLoading;
  }
  
  console.log('RecommendationChat messages changed:', { messages, status, isLoading });
  
  const [localInput, setLocalInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = false;
        rec.interimResults = false;
        rec.lang = 'en-IN'; // Optimized language tag for Indian English and Hinglish terms

        rec.onstart = () => {
          setIsListening(true);
        };

        rec.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setLocalInput((prev) => (prev ? prev + ' ' + transcript : transcript));
        };

        rec.onerror = (event: any) => {
          console.error('Speech recognition error:', event);
          setIsListening(false);
        };

        rec.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = rec;
      }
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported in this browser. Please try using Google Chrome.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
  };

  const onFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!localInput.trim()) return;
    sendMessage({ text: localInput });
    setLocalInput('');
  };

  const handleQuickPrompt = (query: string) => {
    sendMessage({ text: query });
  };
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-4xl mx-auto w-full bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="bg-white/5 border-b border-white/5 p-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/20">
            <Sparkles className="text-emerald-400" size={18} />
          </div>
          <div>
            <h1 className="text-base font-bold text-white leading-none">Kartify Brain</h1>
            <p className="text-white/40 text-xs mt-1">Occasion & recipient aware recommendation engine</p>
          </div>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8 scroll-smooth">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
            <div className="space-y-2 opacity-80">
              <ShoppingBag size={42} className="text-emerald-400 mx-auto animate-pulse" />
              <h2 className="text-xl text-white font-bold">What are you looking for today?</h2>
              <p className="text-white/50 text-sm max-w-md">
                Ask me for recommendations. I will ask clarifying questions about budget and recipient, then eliminate irrelevant stores dynamically!
              </p>
            </div>
            
            {/* Quick Prompts */}
            <div className="grid grid-cols-2 gap-3 max-w-lg w-full">
              {QUICK_PROMPTS.map((prompt) => {
                const IconComponent = prompt.icon;
                return (
                  <button
                    key={prompt.label}
                    onClick={() => handleQuickPrompt(prompt.query)}
                    className="flex items-center gap-2.5 p-3 rounded-2xl bg-white/5 border border-white/5 hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all text-left text-xs font-semibold text-white/90 group"
                  >
                    <IconComponent size={14} className="text-emerald-400 group-hover:scale-110 transition-transform" />
                    <span>{prompt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((m) => (
            <motion.div 
              key={m.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'} w-full gap-3`}
            >
              {m.parts.map((part, idx) => {
                if (part.type === 'text') {
                  return (
                    <div 
                      key={`text-${idx}`}
                      className={`max-w-[85%] px-5 py-3 rounded-2xl text-sm ${
                        m.role === 'user' 
                          ? 'bg-emerald-500/20 text-emerald-50 border border-emerald-500/30 rounded-br-sm' 
                          : 'bg-white/5 text-white/90 border border-white/10 rounded-bl-sm'
                      }`}
                    >
                      <div className="prose prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-black/50 whitespace-pre-line">
                        {part.text}
                      </div>
                    </div>
                  );
                }
                
                if (part.type === 'tool-findProducts' || part.type.startsWith('tool-')) {
                  const toolCallId = (part as any).toolCallId;
                  const state = (part as any).state;
                  
                  if (state === 'output-available') {
                    const products: Product[] = (part as any).output;
                    if (!products || products.length === 0) return (
                      <div key={toolCallId} className="text-white/40 italic text-xs mt-2 flex items-center gap-1.5 bg-white/5 px-4 py-2.5 rounded-xl border border-white/5">
                        <ShieldAlert size={14} className="text-amber-400" /> No products found for that search.
                      </div>
                    );

                    return (
                      <div key={toolCallId} className="w-full mt-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                          {products.map(product => (
                            <ProductCard key={product.id} product={product} />
                          ))}
                        </div>
                      </div>
                    );
                  } else if (state === 'output-error') {
                    return (
                      <div key={toolCallId} className="text-red-400 italic text-xs mt-2 flex items-center gap-1.5 bg-red-500/10 px-4 py-2.5 rounded-xl border border-red-500/20">
                        <ShieldAlert size={14} />
                        {(part as any).errorText || 'Error searching database.'}
                      </div>
                    );
                  } else {
                    return (
                      <div key={toolCallId} className="flex items-center gap-2 text-white/50 bg-white/5 px-4 py-2.5 rounded-full text-xs w-fit mt-2 border border-white/10">
                        <Loader2 size={13} className="animate-spin text-emerald-400" />
                        Searching active stores (filtering platforms)...
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
          <div className="flex items-center gap-2 text-white/50 text-xs bg-white/5 px-4 py-2.5 rounded-full border border-white/5 w-fit">
            <Loader2 size={13} className="animate-spin text-emerald-400" />
            Kartify is thinking...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white/5 border-t border-white/5">
        <form 
          onSubmit={onFormSubmit}
          className="relative flex items-center max-w-3xl mx-auto"
        >
          <input
            value={localInput}
            onChange={(e) => setLocalInput(e.target.value)}
            placeholder={isListening ? "Listening... Speak now..." : "Type your request here..."}
            className="w-full bg-slate-950/80 border border-white/10 rounded-full px-6 py-4 pr-28 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition-all text-sm"
            disabled={isLoading}
          />
          <div className="absolute right-2 flex items-center gap-1.5">
            <button
              type="button"
              onClick={toggleListening}
              className={`p-3 rounded-full border transition-all ${
                isListening 
                  ? 'bg-red-500/20 border-red-500/40 text-red-400 animate-pulse' 
                  : 'bg-white/5 border-white/5 text-white/60 hover:text-white hover:bg-white/10'
              }`}
              title={isListening ? "Stop listening" : "Record voice input"}
            >
              <Mic size={16} />
            </button>
            <button
              type="submit"
              disabled={isLoading || !localInput.trim()}
              className="p-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20"
            >
              <Send size={16} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
