'use client';
import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Mic, RefreshCw } from 'lucide-react';
import { useChatStore } from '../store/useChatStore';

export default function ChatInput({ onSendMessage }) {
  const [input, setInput] = useState('');
  const { isLoading, clearChat } = useChatStore();
  const textareaRef = useRef(null);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
  }, [input]);

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (input.trim() && !isLoading) {
      onSendMessage(input.trim());
      setInput('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const suggestions = [
    'Gaming PC under ₹60k',
    'Birthday gift for mom',
    'Best wireless earbuds',
    'Skincare for oily skin',
  ];

  return (
    <div className="bg-white border-t border-slate-100 px-4 pt-3 pb-safe pb-4">
      {/* Quick suggestion chips — only show when chat is empty */}
      <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2 mb-2">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => !isLoading && onSendMessage(s)}
            className="flex-shrink-0 text-xs font-medium px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-full border border-indigo-100 transition-colors whitespace-nowrap"
          >
            {s}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="relative flex items-end gap-2">
        {/* Sparkles icon */}
        <div className="absolute left-3.5 bottom-3.5 text-indigo-400 pointer-events-none">
          <Sparkles size={18} />
        </div>

        {/* Input */}
        <textarea
          ref={textareaRef}
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Kartify for recommendations..."
          className="w-full resize-none bg-slate-50 border border-slate-200 text-slate-800 rounded-2xl pl-11 pr-14 py-3.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all shadow-sm text-sm leading-snug placeholder:text-slate-400"
          disabled={isLoading}
          style={{ minHeight: '50px', maxHeight: '120px' }}
        />

        {/* Send button */}
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="absolute right-2 bottom-2 p-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl transition-all flex items-center justify-center shadow-sm active:scale-95"
        >
          <Send size={16} className={input.trim() ? 'translate-x-0.5 -translate-y-0.5' : ''} />
        </button>
      </form>

      {/* Footer row */}
      <div className="flex items-center justify-between mt-2 px-1">
        <p className="text-[10px] text-slate-400 font-medium tracking-wide uppercase">
          Powered by Kartify AI • Free & Unrestricted
        </p>
        <button
          onClick={clearChat}
          className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-600 transition-colors"
          title="Start a new chat"
        >
          <RefreshCw size={10} />
          New chat
        </button>
      </div>
    </div>
  );
}
