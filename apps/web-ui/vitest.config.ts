import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
    plugins: [svelte({ hot: !process.env.VITEST })],
    test: {
        globals: true,
        environment: 'happy-dom',
        setupFiles: ['./src/setupTests.ts'],
        include: ['src/**/*.{test,spec}.{js,ts}'],
        exclude: [
            'src/**/*.svelte.d.ts',
            // Temporarily exclude Svelte component tests due to Svelte 5 compatibility issues
            'src/lib/components/**/*.test.ts',
            'src/lib/assets/components/**/*.test.ts',
            'src/routes/**/*.test.ts',
            // Exclude i18n test due to intl-messageformat dependency issue
            'src/lib/i18n/**/*.test.ts'
        ]
    },
    resolve: {
        alias: {
            '$lib': './src/lib',
            '$app': './src/app'
        }
    },
    define: {
        global: 'globalThis',
    }
});
