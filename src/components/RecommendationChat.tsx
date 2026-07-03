'use client';

import { useChat } from '@ai-sdk/react';
import { ProductCard } from './ProductCard';
import { Product } from '../lib/types/product';
import { Send, Loader2, Sparkles, ShoppingBag, Gift, Laptop, Sparkle, ShieldAlert, Mic, Search, Brain, Zap } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';

// ── Animated thinking indicator ──────────────────────────────────────────────
const THINKING_STAGES = [
  { icon: Brain,  label: 'Thinking...',           color: 'text-violet-400',  bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
  { icon: Search, label: 'Searching stores...',    color: 'text-blue-400',    bg: 'bg-blue-500/10',   border: 'border-blue-500/20'   },
  { icon: Zap,    label: 'Finding best deals...', color: 'text-emerald-400', bg: 'bg-emerald-500/10',border: 'border-emerald-500/20'},
];

function ThinkingIndicator() {
  const [stageIdx, setStageIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStageIdx(prev => (prev + 1) % THINKING_STAGES.length);
    }, 1400);
    return () => clearInterval(interval);
  }, []);

  const stage = THINKING_STAGES[stageIdx];
  const Icon = stage.icon;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={stageIdx}
        initial={{ opacity: 0, y: 6, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -6, scale: 0.95 }}
        transition={{ duration: 0.25 }}
        className={`flex items-center gap-2.5 px-4 py-2.5 rounded-full border w-fit text-xs font-medium ${stage.bg} ${stage.border} ${stage.color}`}
      >
        <Icon size={13} className="animate-pulse" />
        <span>{stage.label}</span>
        <span className="flex gap-0.5">
          {[0,1,2].map(i => (
            <motion.span
              key={i}
              className={`w-1 h-1 rounded-full ${stage.color.replace('text-', 'bg-')}`}
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.2 }}
            />
          ))}
        </span>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Quick reply option detection ─────────────────────────────────────────────
function detectQuickOptions(text: string): string[] | null {
  // Recipient / who is it for
  if (/(who|whom).{0,30}(for|is|shopping|buying|gift)|(for whom|recipient|buying this for|gift.*for|shopping.*for)/i.test(text)) {
    return ['Myself', 'Mom / Mother', 'Dad / Father', 'Partner / Spouse', 'Friend', 'Sibling', 'Kid / Child'];
  }
  // Budget / price
  if (/(budget|how much|price range|spend|afford|cost|inr|rupee)/i.test(text)) {
    return ['Under ₹500', '₹500 – ₹1,000', '₹1,000 – ₹3,000', '₹3,000 – ₹5,000', 'Above ₹5,000'];
  }
  // Occasion / purpose
  if (/(occasion|event|celebrat|purpose|reason|why)/i.test(text)) {
    return ['Birthday 🎂', 'Anniversary 💍', 'Festival / Diwali 🪔', 'Daily Use', 'Just Because 🎁'];
  }
  // Category / product type
  if (/(type|kind|category|what.*product|what.*looking|what.*need|interest|hobby|hobbies|thinking of)/i.test(text)) {
    return ['Electronics', 'Fashion / Clothing', 'Shoes / Footwear', 'Skincare / Beauty', 'Books', 'Food & Gourmet', 'Accessories'];
  }
  // Platform preference
  if (/(platform|website|site|where.*shop|prefer.*shop|online store)/i.test(text)) {
    return ['Amazon', 'Flipkart', 'Myntra', 'Nykaa', 'Meesho', 'Any Platform'];
  }
  // Use case / style
  if (/(daily|gym|office|workout|casual|formal|occasion|style|wear|activity)/i.test(text)) {
    return ['Casual / Daily Wear', 'Formal / Office', 'Gym / Sports', 'Party / Festive', 'Outdoor / Travel'];
  }
  // Gender / who is using
  if (/(gender|male|female|men|women|boy|girl|himself|herself)/i.test(text)) {
    return ['Men', 'Women', 'Kids / Unisex'];
  }
  return null;
}

function QuickReplies({ text, onSelect, disabled }: { text: string; onSelect: (v: string) => void; disabled: boolean }) {
  const options = detectQuickOptions(text);
  if (!options) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.2 }}
      className="flex flex-wrap gap-2 mt-2 ml-1"
    >
      {options.map(opt => (
        <button
          key={opt}
          onClick={() => !disabled && onSelect(opt)}
          disabled={disabled}
          className="px-3 py-1.5 text-xs rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/25 hover:border-emerald-400/60 transition-all disabled:opacity-40 disabled:cursor-not-allowed font-medium"
        >
          {opt}
        </button>
      ))}
    </motion.div>
  );
}

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
  const [user, setUser] = useState<any>(null);
  const [lastUserMsgId, setLastUserMsgId] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
    };
    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  // Listen to search triggers from Profile Drawer
  useEffect(() => {
    const handleTriggerSearch = (e: Event) => {
      const query = (e as CustomEvent).detail;
      if (query) {
        sendMessage({ text: query });
        saveSearchToHistory(query);
        saveRecipientFromQuery(query);
      }
    };
    window.addEventListener('kartify_trigger_search', handleTriggerSearch);
    return () => window.removeEventListener('kartify_trigger_search', handleTriggerSearch);
  }, [sendMessage, user]); // Added user to dependencies

  const saveSearchToHistory = async (query: string) => {
    try {
      const history = JSON.parse(localStorage.getItem('kartify_search_history') || '[]');
      const filtered = history.filter((h: any) => h.query.toLowerCase() !== query.toLowerCase());
      const updated = [
        { id: Date.now().toString(), query, date: new Date().toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) },
        ...filtered
      ].slice(0, 10);
      localStorage.setItem('kartify_search_history', JSON.stringify(updated));

      if (user) {
        await supabase.from('search_history').insert({
          user_id: user.id,
          query,
          occasion: query.toLowerCase().includes('gift') ? 'Gifting' : 'General'
        });
      }
    } catch (e) {
      console.error('History save error:', e);
    }
  };

  const saveRecipientFromQuery = async (query: string) => {
    const lower = query.toLowerCase();
    let relation = '';
    let name = '';
    
    if (lower.includes('mom') || lower.includes('mother')) {
      relation = 'Mom';
      name = 'Mother';
    } else if (lower.includes('dad') || lower.includes('father')) {
      relation = 'Dad';
      name = 'Father';
    } else if (lower.includes('sister')) {
      relation = 'Sister';
      name = 'Priya';
    } else if (lower.includes('brother')) {
      relation = 'Brother';
      name = 'Rahul';
    } else if (lower.includes('friend')) {
      relation = 'Friend';
      name = 'Amit';
    } else if (lower.includes('wife')) {
      relation = 'Wife';
      name = 'Anjali';
    } else if (lower.includes('husband')) {
      relation = 'Husband';
      name = 'Vikram';
    }

    if (relation) {
      try {
        const recipients = JSON.parse(localStorage.getItem('kartify_saved_recipients') || '[]');
        const interests = lower.includes('phone') || lower.includes('tech') || lower.includes('laptop') || lower.includes('audio') ? 'Tech & Gadgets' : 'Fashion & Gifting';
        if (!recipients.some((r: any) => r.relation.toLowerCase() === relation.toLowerCase())) {
          const newRecipient = {
            id: Date.now().toString(),
            name,
            relation,
            interests
          };
          localStorage.setItem('kartify_saved_recipients', JSON.stringify([newRecipient, ...recipients]));
        }

        if (user) {
          // Check if recipient relationship exists in db first
          const { data } = await supabase
            .from('saved_recipients')
            .select('id')
            .eq('user_id', user.id)
            .eq('relation', relation);
          
          if (!data || data.length === 0) {
            await supabase.from('saved_recipients').insert({
              user_id: user.id,
              name,
              relation,
              interests,
              age_group: 'All'
            });
          }
        }
      } catch (e) {
        console.error('Recipient save error:', e);
      }
    }
  };

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
    if (!localInput.trim() || isLoading) return;
    const msg = localInput.trim();
    setLastUserMsgId(msg + Date.now());
    setLocalInput('');
    sendMessage({ role: 'user', text: msg });
  };

  const handleQuickReply = (val: string) => {
    if (isLoading) return;
    setLastUserMsgId(val + Date.now());
    sendMessage({ role: 'user', text: val });
  };

  const handleQuickPrompt = (query: string) => {
    sendMessage({ role: 'user', text: query });
    saveSearchToHistory(query);
    saveRecipientFromQuery(query);
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
              {(m.parts || [{ type: 'text', text: (m as any).text || (m as any).content }]).map((part: any, idx: number) => {
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
                
                if (part.type === 'tool-invocation' || part.type.startsWith('tool-')) {
                  const toolCallId = part.toolInvocation?.toolCallId || (part as any).toolCallId;
                  const state = part.toolInvocation?.state || (part as any).state;
                  
                  if (state === 'result' || state === 'output-available') {
                    const products: Product[] = part.toolInvocation?.result || (part as any).output;
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
                  } else if (state === 'output-error' || state === 'error') {
                    return (
                      <div key={toolCallId} className="text-red-400 italic text-xs mt-2 flex items-center gap-1.5 bg-red-500/10 px-4 py-2.5 rounded-xl border border-red-500/20">
                        <ShieldAlert size={14} />
                        {(part as any).errorText || 'Error searching database.'}
                      </div>
                    );
                  } else {
                    // Tool is actively running — show searching indicator
                    return (
                      <motion.div
                        key={toolCallId}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-2.5 text-blue-400 bg-blue-500/10 px-4 py-2.5 rounded-full text-xs font-medium w-fit mt-2 border border-blue-500/20"
                      >
                        <Search size={13} className="animate-pulse" />
                        Searching live stores...
                        <span className="flex gap-0.5">
                          {[0,1,2].map(i => (
                            <motion.span
                              key={i}
                              className="w-1 h-1 rounded-full bg-blue-400"
                              animate={{ opacity: [0.3, 1, 0.3] }}
                              transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.2 }}
                            />
                          ))}
                        </span>
                      </motion.div>
                    );
                  }
                }
                
                return null;
              })}
            </motion.div>
          ))}
        </AnimatePresence>
        
        {/* Quick replies after last AI message */}
        {!isLoading && (() => {
          const lastAI = [...messages].reverse().find(m => m.role === 'assistant');
          const lastUser = [...messages].reverse().find(m => m.role === 'user');
          // Only show if last message is from AI (user hasn't replied yet)
          if (!lastAI || (lastUser && messages.indexOf(lastUser) > messages.indexOf(lastAI))) return null;
          const aiText = lastAI.parts
            ?.filter((p: any) => p.type === 'text')
            .map((p: any) => p.text || '')
            .join(' ') || '';
          if (!aiText.includes('?')) return null;
          return (
            <AnimatePresence>
              <QuickReplies
                key={lastAI.id}
                text={aiText}
                onSelect={handleQuickReply}
                disabled={isLoading}
              />
            </AnimatePresence>
          );
        })()}

        {isLoading && messages[messages.length - 1]?.role === 'user' && (
          <ThinkingIndicator />
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
            placeholder={isListening ? "Listening... Speak now..." : "Type your own answer or pick above..."}
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
