import { create } from 'zustand';
import { uid } from '@/lib/id';

export interface Toast {
  id: string;
  message: string;
}

interface ToastStore {
  toasts: Toast[];
  push: (message: string, ms?: number) => void;
  dismiss: (id: string) => void;
}

export const useToasts = create<ToastStore>((set) => ({
  toasts: [],
  push: (message, ms = 2600) => {
    const id = uid(6);
    set((s) => ({ toasts: [...s.toasts.slice(-2), { id, message }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), ms);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = (message: string, ms?: number) => useToasts.getState().push(message, ms);
