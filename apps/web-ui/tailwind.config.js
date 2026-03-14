/** @type {import('tailwindcss').Config} */
export default {
    content: [
        './src/**/*.{html,js,svelte,ts}',
        './node_modules/flowbite-svelte/**/*.{html,js,svelte,ts}',
    ],
    darkMode: ['selector', '[data-theme="dark"]'],
    theme: {
        extend: {
            /* ── Semantic color system ────────────────────────────── */
            colors: {
                brand: { 50: '#f0f9ff', 100: '#e0f2fe', 200: '#bae6fd', 300: '#7dd3fc', 400: '#38bdf8', 500: '#0ea5e9', 600: '#0284c7', 700: '#0369a1', 800: '#075985', 900: '#0c4a6e', 950: '#082f49' },
                primary: { DEFAULT: '#0ea5e9', hover: '#38bdf8', active: '#0284c7', light: '#e0f2fe', lighter: '#f0f9ff' },
                success: { DEFAULT: '#10b981', hover: '#059669', light: '#d1fae5', lighter: '#ecfdf5' },
                warning: { DEFAULT: '#f59e0b', hover: '#d97706', light: '#fef3c7', lighter: '#fffbeb' },
                error: { DEFAULT: '#ef4444', hover: '#dc2626', light: '#fee2e2', lighter: '#fef2f2' },
                info: { DEFAULT: '#6366f1', hover: '#4f46e5', light: '#e0e7ff', lighter: '#eef2ff' },
                /* Dark layered surfaces — token-driven, alpha-safe */
                surface: {
                    bg: 'rgb(var(--color-bg) / <alpha-value>)',
                    1: 'rgb(var(--color-surface) / <alpha-value>)',
                    2: 'rgb(var(--color-surface-2) / <alpha-value>)',
                    3: 'rgb(var(--color-elevated) / <alpha-value>)',
                },
                /* Semantic border / divide colors */
                border: 'var(--color-border)',
                'border-strong': 'var(--color-border-strong)',
            },

            /* ── Typography ──────────────────────────────────────── */
            fontFamily: {
                sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
                mono: ['JetBrains Mono', 'Fira Code', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
            },
            fontSize: {
                '2xs': ['0.625rem', { lineHeight: '0.875rem' }],   // 10/14
                xs: ['0.75rem', { lineHeight: '1rem' }],        // 12/16
                sm: ['0.8125rem', { lineHeight: '1.25rem' }],     // 13/20
                base: ['0.875rem', { lineHeight: '1.375rem' }],    // 14/22
            },

            /* ── Spacing (8pt compact) ───────────────────────────── */
            spacing: {
                '0.5': '2px',
                '1': '4px',
                '1.5': '6px',
                '2': '8px',
                '3': '12px',
                '4': '16px',
                '5': '20px',
                '6': '24px',
                '8': '32px',
                '10': '40px',
                '12': '48px',
            },

            /* ── Radius ──────────────────────────────────────────── */
            borderRadius: {
                sm: '4px',
                DEFAULT: '6px',
                md: '8px',
                lg: '10px',
                xl: '12px',
                '4xl': '2rem',
            },

            /* ── Elevation / Shadows ─────────────────────────────── */
            boxShadow: {
                xs: 'var(--shadow-xs)',
                soft: 'var(--shadow-sm)',
                'soft-md': 'var(--shadow-md)',
                'soft-lg': 'var(--shadow-lg)',
                card: 'var(--shadow-card)',
                modal: 'var(--shadow-modal)',
                'focus-ring': 'var(--shadow-focus-ring)',
            },

            /* ── Animations ──────────────────────────────────────── */
            animation: {
                'fade-in': 'fadeIn 150ms ease-out',
                'slide-up': 'slideUp 150ms ease-out',
                'slide-in-left': 'slideInLeft 150ms ease-out',
                'spin-slow': 'spin 1.5s linear infinite',
            },
            keyframes: {
                fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
                slideUp: { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
                slideInLeft: { '0%': { opacity: '0', transform: 'translateX(-12px)' }, '100%': { opacity: '1', transform: 'translateX(0)' } },
            },

            /* ── Z-Index ─────────────────────────────────────────── */
            zIndex: {
                dropdown: '10',
                sticky: '20',
                overlay: '30',
                sidebar: '40',
                header: '50',
                modal: '60',
                popover: '70',
                toast: '80',
                tooltip: '90',
            },
        },
    },
    plugins: [],
}
