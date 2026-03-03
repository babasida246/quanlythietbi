import { writable } from 'svelte/store';

export type ToastLevel = 'success' | 'error' | 'info';

export type ToastItem = {
  id: string;
  level: ToastLevel;
  message: string;
  timeout: number;
};

const toastsStore = writable<ToastItem[]>([]);

export const toasts = {
  subscribe: toastsStore.subscribe
};

function push(level: ToastLevel, message: string, timeout = 3000): string {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const toast: ToastItem = { id, level, message, timeout };
  toastsStore.update((items) => [...items, toast]);

  if (timeout > 0) {
    setTimeout(() => {
      dismissToast(id);
    }, timeout);
  }

  return id;
}

export function dismissToast(id: string): void {
  toastsStore.update((items) => items.filter((item) => item.id !== id));
}

export const toast = {
  success: (message: string, timeout?: number) => push('success', message, timeout),
  error: (message: string, timeout?: number) => push('error', message, timeout),
  info: (message: string, timeout?: number) => push('info', message, timeout)
};
