import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export type ThemeMode = 'dark' | 'light';
type TokenType = 'channel' | 'color';

export type ThemeTokenDef = {
    key: string;
    labelKey: string;
    type: TokenType;
};

export type ThemeTokenGroup = {
    titleKey: string;
    tokens: ThemeTokenDef[];
};

export type ThemeCustomizerConfig = {
    enabled: boolean;
    dark: Record<string, string>;
    light: Record<string, string>;
};

const STORAGE_KEY = 'theme_customizer_v1';
const STYLE_STORAGE_KEY = 'theme_customizer_css_v1';
const STYLE_ID = 'custom-theme-overrides';

export const TOKEN_GROUPS: ThemeTokenGroup[] = [
    {
        titleKey: 'themeCustomizer.groups.surfaces',
        tokens: [
            { key: '--color-bg', labelKey: 'themeCustomizer.tokens.colorBg', type: 'channel' },
            { key: '--color-surface', labelKey: 'themeCustomizer.tokens.colorSurface', type: 'channel' },
            { key: '--color-surface-2', labelKey: 'themeCustomizer.tokens.colorSurface2', type: 'channel' },
            { key: '--color-elevated', labelKey: 'themeCustomizer.tokens.colorElevated', type: 'channel' }
        ]
    },
    {
        titleKey: 'themeCustomizer.groups.textBorder',
        tokens: [
            { key: '--color-text', labelKey: 'themeCustomizer.tokens.colorText', type: 'color' },
            { key: '--color-text-muted', labelKey: 'themeCustomizer.tokens.colorTextMuted', type: 'color' },
            { key: '--color-text-dim', labelKey: 'themeCustomizer.tokens.colorTextDim', type: 'color' },
            { key: '--color-border', labelKey: 'themeCustomizer.tokens.colorBorder', type: 'color' },
            { key: '--color-border-strong', labelKey: 'themeCustomizer.tokens.colorBorderStrong', type: 'color' }
        ]
    },
    {
        titleKey: 'themeCustomizer.groups.brandStatus',
        tokens: [
            { key: '--color-primary', labelKey: 'themeCustomizer.tokens.colorPrimary', type: 'color' },
            { key: '--color-primary-hover', labelKey: 'themeCustomizer.tokens.colorPrimaryHover', type: 'color' },
            { key: '--color-primary-active', labelKey: 'themeCustomizer.tokens.colorPrimaryActive', type: 'color' },
            { key: '--color-success', labelKey: 'themeCustomizer.tokens.colorSuccess', type: 'color' },
            { key: '--color-warning', labelKey: 'themeCustomizer.tokens.colorWarning', type: 'color' },
            { key: '--color-danger', labelKey: 'themeCustomizer.tokens.colorDanger', type: 'color' },
            { key: '--color-info', labelKey: 'themeCustomizer.tokens.colorInfo', type: 'color' }
        ]
    },
    {
        titleKey: 'themeCustomizer.groups.sidebarHeader',
        tokens: [
            { key: '--sidebar-bg', labelKey: 'themeCustomizer.tokens.sidebarBg', type: 'color' },
            { key: '--sidebar-surface', labelKey: 'themeCustomizer.tokens.sidebarSurface', type: 'color' },
            { key: '--sidebar-accent', labelKey: 'themeCustomizer.tokens.sidebarAccent', type: 'color' },
            { key: '--sidebar-accent-text', labelKey: 'themeCustomizer.tokens.sidebarAccentText', type: 'color' }
        ]
    }
];

const DEFAULT_DARK: Record<string, string> = {
    '--color-bg': '11 18 32',
    '--color-surface': '18 27 46',
    '--color-surface-2': '15 23 42',
    '--color-elevated': '26 37 64',
    '--color-text': '#F8FAFC',
    '--color-text-muted': '#CBD5E1',
    '--color-text-dim': '#94A3B8',
    '--color-border': '#334155',
    '--color-border-strong': '#475569',
    '--color-primary': '#0EA5E9',
    '--color-primary-hover': '#38BDF8',
    '--color-primary-active': '#0284C7',
    '--color-success': '#10B981',
    '--color-warning': '#F59E0B',
    '--color-danger': '#EF4444',
    '--color-info': '#6366F1',
    '--sidebar-bg': '#0B1220',
    '--sidebar-surface': '#121B2E',
    '--sidebar-accent': '#0C4A6E',
    '--sidebar-accent-text': '#38BDF8'
};

const DEFAULT_LIGHT: Record<string, string> = {
    '--color-bg': '248 250 252',
    '--color-surface': '255 255 255',
    '--color-surface-2': '236 242 248',
    '--color-elevated': '218 226 236',
    '--color-text': '#0F172A',
    '--color-text-muted': '#334155',
    '--color-text-dim': '#64748B',
    '--color-border': '#CBD5E1',
    '--color-border-strong': '#94A3B8',
    '--color-primary': '#0EA5E9',
    '--color-primary-hover': '#0284C7',
    '--color-primary-active': '#0369A1',
    '--color-success': '#059669',
    '--color-warning': '#D97706',
    '--color-danger': '#DC2626',
    '--color-info': '#4F46E5',
    '--sidebar-bg': '#0B1220',
    '--sidebar-surface': '#121B2E',
    '--sidebar-accent': '#0C4A6E',
    '--sidebar-accent-text': '#38BDF8'
};

const TOKEN_INDEX = new Map<string, ThemeTokenDef>();
for (const group of TOKEN_GROUPS) {
    for (const token of group.tokens) TOKEN_INDEX.set(token.key, token);
}

function hexToRgbChannels(hex: string): string {
    const normalized = hex.trim().replace('#', '');
    const full = normalized.length === 3
        ? normalized.split('').map((c) => c + c).join('')
        : normalized;
    const intVal = Number.parseInt(full, 16);
    const r = (intVal >> 16) & 255;
    const g = (intVal >> 8) & 255;
    const b = intVal & 255;
    return `${r} ${g} ${b}`;
}

function channelsToHex(channels: string): string {
    const parts = channels
        .trim()
        .split(/\s+/)
        .slice(0, 3)
        .map((v) => Number.parseInt(v, 10))
        .map((n) => Number.isNaN(n) ? 0 : Math.max(0, Math.min(255, n)));

    const [r, g, b] = [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
    return `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

function getDefaultConfig(): ThemeCustomizerConfig {
    return {
        enabled: false,
        dark: { ...DEFAULT_DARK },
        light: { ...DEFAULT_LIGHT }
    };
}

function normalizeConfig(raw: Partial<ThemeCustomizerConfig> | null): ThemeCustomizerConfig {
    const defaults = getDefaultConfig();
    if (!raw) return defaults;
    return {
        enabled: raw.enabled ?? defaults.enabled,
        dark: { ...defaults.dark, ...(raw.dark ?? {}) },
        light: { ...defaults.light, ...(raw.light ?? {}) }
    };
}

function buildCss(config: ThemeCustomizerConfig): string {
    const toBlock = (vars: Record<string, string>) => Object.entries(vars)
        .map(([key, value]) => `  ${key}: ${value};`)
        .join('\n');

    return `:root {\n${toBlock(config.dark)}\n}\n\nhtml:not([data-theme="dark"]) {\n${toBlock(config.light)}\n}`;
}

function applyStyle(cssText: string, enabled: boolean) {
    if (!browser) return;
    const existing = document.getElementById(STYLE_ID);
    if (!enabled || !cssText.trim()) {
        existing?.remove();
        localStorage.removeItem(STYLE_STORAGE_KEY);
        return;
    }

    const styleEl = existing ?? document.createElement('style');
    styleEl.id = STYLE_ID;
    styleEl.textContent = cssText;
    if (!existing) document.head.appendChild(styleEl);
    localStorage.setItem(STYLE_STORAGE_KEY, cssText);
}

function persistConfig(config: ThemeCustomizerConfig) {
    if (!browser) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

function loadConfig(): ThemeCustomizerConfig {
    if (!browser) return getDefaultConfig();
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return getDefaultConfig();
        return normalizeConfig(JSON.parse(raw) as Partial<ThemeCustomizerConfig>);
    } catch {
        return getDefaultConfig();
    }
}

function createThemeCustomizerStore() {
    const initial = loadConfig();
    const { subscribe, update, set } = writable<ThemeCustomizerConfig>(initial);

    if (browser && initial.enabled) {
        applyStyle(buildCss(initial), true);
    }

    return {
        subscribe,
        init() {
            const cfg = loadConfig();
            set(cfg);
            applyStyle(buildCss(cfg), cfg.enabled);
        },
        setEnabled(enabled: boolean) {
            update((current) => {
                const next = { ...current, enabled };
                persistConfig(next);
                applyStyle(buildCss(next), next.enabled);
                return next;
            });
        },
        setTokenFromHex(mode: ThemeMode, tokenKey: string, hex: string) {
            const def = TOKEN_INDEX.get(tokenKey);
            if (!def) return;

            update((current) => {
                const next = {
                    ...current,
                    [mode]: {
                        ...current[mode],
                        [tokenKey]: def.type === 'channel' ? hexToRgbChannels(hex) : hex
                    }
                } as ThemeCustomizerConfig;

                persistConfig(next);
                applyStyle(buildCss(next), next.enabled);
                return next;
            });
        },
        resetMode(mode: ThemeMode) {
            update((current) => {
                const next = {
                    ...current,
                    [mode]: mode === 'dark' ? { ...DEFAULT_DARK } : { ...DEFAULT_LIGHT }
                } as ThemeCustomizerConfig;

                persistConfig(next);
                applyStyle(buildCss(next), next.enabled);
                return next;
            });
        },
        resetAll() {
            const next = getDefaultConfig();
            set(next);
            persistConfig(next);
            applyStyle('', false);
        }
    };
}

export function tokenHexValue(config: ThemeCustomizerConfig, mode: ThemeMode, token: ThemeTokenDef): string {
    const value = config[mode][token.key];
    if (token.type === 'channel') return channelsToHex(value);
    if (/^#[0-9a-f]{6}$/i.test(value)) return value;
    return '#000000';
}

export const themeCustomizer = createThemeCustomizerStore();
