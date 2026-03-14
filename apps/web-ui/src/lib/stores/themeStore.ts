import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'theme';

function applyTheme(theme: Theme) {
    if (!browser) return;
    const html = document.documentElement;
    html.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);
}

function createThemeStore() {
    const initial: Theme = browser
        ? ((localStorage.getItem(STORAGE_KEY) as Theme) ?? 'dark')
        : 'dark';

    const { subscribe, update } = writable<Theme>(initial);

    if (browser) {
        applyTheme(initial);
    }

    return {
        subscribe,
        toggle() {
            update((current) => {
                const next: Theme = current === 'dark' ? 'light' : 'dark';
                applyTheme(next);
                return next;
            });
        }
    };
}

export const theme = createThemeStore();
