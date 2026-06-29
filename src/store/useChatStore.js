import { create } from 'zustand';

export const useChatStore = create((set, get) => ({
  messages: [
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Hi! I am Kartify, your AI shopping assistant. What are you looking for today? (e.g. "a gaming PC", or "birthday gift for mom")',
    },
  ],
  context: {
    occasion: null,
    recipient: null,
    budget: null,
    platforms: ['Amazon', 'Flipkart', 'Myntra', 'Nykaa', 'Meesho'],
    constraints: [],
  },
  isLoading: false,

  addMessage: (message) => 
    set((state) => ({ messages: [...state.messages, { ...message, id: Date.now().toString() }] })),

  setLoading: (isLoading) => set({ isLoading }),

  updateContext: (newContext) => 
    set((state) => ({ context: { ...state.context, ...newContext } })),

  clearChat: () => set({ 
    messages: [
      {
        id: 'welcome',
        role: 'assistant',
        content: 'Hi! I am Kartify, your AI shopping assistant. What are you looking for today? (e.g. "a gaming PC", or "birthday gift for mom")',
      },
    ],
    context: {
      occasion: null,
      recipient: null,
      budget: null,
      platforms: ['Amazon', 'Flipkart', 'Myntra', 'Nykaa', 'Meesho'],
      constraints: [],
    }
  }),
}));
