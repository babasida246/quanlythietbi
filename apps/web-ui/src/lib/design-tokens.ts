/**
 * Design Tokens — Ant Design Dashboard Density (CMDB/ITAM)
 * Single source of truth for all UI values.
 *
 * USAGE:
 *   import { tokens } from '$lib/design-tokens';
 *   <div style="padding: {tokens.space[4]}">…</div>
 *
 * Most values are also exposed in tailwind.config.js and app.css,
 * so prefer Tailwind utilities. Use this file for JS-side logic only.
 */

/* ------------------------------------------------------------------ */
/*  Color Palette                                                      */
/* ------------------------------------------------------------------ */
export const colors = {
    /* Semantic */
    primary: { DEFAULT: '#0ea5e9', hover: '#38bdf8', active: '#0284c7', light: '#e0f2fe', lighter: '#f0f9ff' },
    success: { DEFAULT: '#10b981', hover: '#059669', light: '#d1fae5', lighter: '#ecfdf5' },
    warning: { DEFAULT: '#f59e0b', hover: '#d97706', light: '#fef3c7', lighter: '#fffbeb' },
    error: { DEFAULT: '#ef4444', hover: '#dc2626', light: '#fee2e2', lighter: '#fef2f2' },
    info: { DEFAULT: '#6366f1', hover: '#4f46e5', light: '#e0e7ff', lighter: '#eef2ff' },

    /* Dark surfaces (layered) — synced with tokens.css CSS variables */
    dark: {
        bg: '#0B1220',         // --color-bg:        11 18 32
        surface1: '#121B2E',   // --color-surface:   18 27 46
        surface2: '#0F172A',   // --color-surface-2: 15 23 42
        surface3: '#1A2540',   // --color-elevated:  26 37 64
        border: 'rgba(148, 163, 184, 0.18)',   // --color-border
        borderSoft: 'rgba(148, 163, 184, 0.35)', // --color-border-strong
        text: 'rgba(248, 250, 252, 0.95)',     // --color-text
        textMuted: 'rgba(226, 232, 240, 0.72)', // --color-text-muted
        textDim: 'rgba(226, 232, 240, 0.50)',   // --color-text-dim
    },

    /* Light surfaces */
    light: {
        bg: '#f8fafc',
        surface1: '#ffffff',
        surface2: '#f1f5f9',
        surface3: '#e2e8f0',
        border: '#e2e8f0',
        borderSoft: '#f1f5f9',
        text: '#0f172a',
        textMuted: '#64748b',
        textDim: '#94a3b8',
    },
} as const;

/* ------------------------------------------------------------------ */
/*  Spacing — 8pt grid with half-steps                                 */
/* ------------------------------------------------------------------ */
export const space = {
    0: '0px',
    0.5: '2px',
    1: '4px',
    1.5: '6px',
    2: '8px',
    3: '12px',
    4: '16px',
    5: '20px',
    6: '24px',
    8: '32px',
    10: '40px',
    12: '48px',
    16: '64px',
} as const;

/* ------------------------------------------------------------------ */
/*  Typography                                                         */
/* ------------------------------------------------------------------ */
export const typography = {
    fontFamily: "'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    fontMono: "'JetBrains Mono', 'Fira Code', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",

    /** font-size / line-height */
    size: {
        '2xs': { fontSize: '0.625rem', lineHeight: '0.875rem' },  // 10/14
        xs: { fontSize: '0.75rem', lineHeight: '1rem' },  // 12/16
        sm: { fontSize: '0.8125rem', lineHeight: '1.25rem' },  // 13/20
        base: { fontSize: '0.875rem', lineHeight: '1.375rem' },  // 14/22  ← body
        lg: { fontSize: '1rem', lineHeight: '1.5rem' },  // 16/24
        xl: { fontSize: '1.125rem', lineHeight: '1.75rem' },  // 18/28
        '2xl': { fontSize: '1.25rem', lineHeight: '1.75rem' },  // 20/28  ← page title
        '3xl': { fontSize: '1.5rem', lineHeight: '2rem' },  // 24/32
    },

    weight: {
        normal: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
    },
} as const;

/* ------------------------------------------------------------------ */
/*  Border Radius                                                      */
/* ------------------------------------------------------------------ */
export const radius = {
    none: '0px',
    sm: '4px',
    md: '6px',
    DEFAULT: '8px',
    lg: '10px',
    xl: '12px',
    full: '9999px',
} as const;

/* ------------------------------------------------------------------ */
/*  Shadows / Elevation                                                */
/* ------------------------------------------------------------------ */
export const shadow = {
    xs: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    sm: '0 1px 3px 0 rgb(0 0 0 / 0.08), 0 1px 2px -1px rgb(0 0 0 / 0.08)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.08)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.08)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.08), 0 8px 10px -6px rgb(0 0 0 / 0.08)',
    modal: '0 25px 50px -12px rgb(0 0 0 / 0.25)',
} as const;

/* ------------------------------------------------------------------ */
/*  Z-Index                                                            */
/* ------------------------------------------------------------------ */
export const zIndex = {
    dropdown: 10,
    sticky: 20,
    overlay: 30,
    sidebar: 40,
    header: 50,
    modal: 60,
    popover: 70,
    toast: 80,
    tooltip: 90,
} as const;

/* ------------------------------------------------------------------ */
/*  Control Sizing (Ant-like compact)                                  */
/* ------------------------------------------------------------------ */
export const control = {
    sm: { height: '28px', px: '10px', fontSize: '12px' },
    md: { height: '32px', px: '12px', fontSize: '13px' },
    lg: { height: '36px', px: '16px', fontSize: '14px' },
} as const;

/* ------------------------------------------------------------------ */
/*  Table                                                              */
/* ------------------------------------------------------------------ */
export const table = {
    headerHeight: '40px',
    rowHeight: '40px',
    cellPadding: { x: '12px', y: '8px' },
} as const;

/* ------------------------------------------------------------------ */
/*  Transitions                                                        */
/* ------------------------------------------------------------------ */
export const transition = {
    fast: '100ms ease',
    normal: '150ms ease',
    slow: '200ms ease',
    spring: '300ms cubic-bezier(0.34, 1.56, 0.64, 1)',
} as const;

/* ------------------------------------------------------------------ */
/*  Breakpoints                                                        */
/* ------------------------------------------------------------------ */
export const breakpoints = {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1440px',
} as const;

/** Convenience aggregate */
export const tokens = {
    colors,
    space,
    typography,
    radius,
    shadow,
    zIndex,
    control,
    table,
    transition,
    breakpoints,
} as const;

export default tokens;
