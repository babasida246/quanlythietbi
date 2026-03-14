import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export type ThemePresetId = 'sky' | 'teal' | 'violet' | 'slate' | 'amber';

export interface ThemePreset {
    id: ThemePresetId;
    nameKey: string;
    descKey: string;
    recommended?: boolean;
    /** Hex swatches for visual preview: [sidebar-bg, accent, bg, success, warning, danger] */
    swatches: string[];
}

export const THEME_PRESETS: ThemePreset[] = [
    {
        id: 'sky',
        nameKey: 'themePresets.sky.name',
        descKey: 'themePresets.sky.desc',
        swatches: ['#0f172a', '#38bdf8', '#111827', '#10b981', '#f59e0b', '#ef4444'],
    },
    {
        id: 'teal',
        nameKey: 'themePresets.teal.name',
        descKey: 'themePresets.teal.desc',
        recommended: true,
        swatches: ['#042f2e', '#2dd4bf', '#0f1f1e', '#10b981', '#d97706', '#ef4444'],
    },
    {
        id: 'violet',
        nameKey: 'themePresets.violet.name',
        descKey: 'themePresets.violet.desc',
        swatches: ['#0d0a1e', '#a78bfa', '#130f28', '#10b981', '#d97706', '#ef4444'],
    },
    {
        id: 'slate',
        nameKey: 'themePresets.slate.name',
        descKey: 'themePresets.slate.desc',
        swatches: ['#0a0f1e', '#60a5fa', '#1e293b', '#10b981', '#d97706', '#f43f5e'],
    },
    {
        id: 'amber',
        nameKey: 'themePresets.amber.name',
        descKey: 'themePresets.amber.desc',
        swatches: ['#0c0800', '#fbbf24', '#1f1300', '#10b981', '#ea580c', '#ef4444'],
    },
];

const STORAGE_KEY = 'qltb_color_scheme';
const DEFAULT_PRESET: ThemePresetId = 'sky';

function applyColorScheme(id: ThemePresetId | null) {
    if (!browser) return;
    const root = document.documentElement;
    if (id && id !== 'sky') {
        root.setAttribute('data-color-scheme', id);
    } else {
        // 'sky' is the default — remove attribute so cascading defaults (tokens.css) apply
        root.removeAttribute('data-color-scheme');
        // Still set 'sky' for explicit matching in themes.css
        root.setAttribute('data-color-scheme', 'sky');
    }
}

function createThemePresetsStore() {
    const initial: ThemePresetId = browser
        ? ((localStorage.getItem(STORAGE_KEY) as ThemePresetId | null) ?? DEFAULT_PRESET)
        : DEFAULT_PRESET;

    const { subscribe, set } = writable<ThemePresetId>(initial);

    return {
        subscribe,
        init() {
            const id = (browser
                ? (localStorage.getItem(STORAGE_KEY) as ThemePresetId | null)
                : null) ?? DEFAULT_PRESET;
            set(id);
            applyColorScheme(id);
        },
        setTheme(id: ThemePresetId) {
            set(id);
            if (browser) {
                localStorage.setItem(STORAGE_KEY, id);
            }
            applyColorScheme(id);
        },
    };
}

export const themePresets = createThemePresetsStore();
