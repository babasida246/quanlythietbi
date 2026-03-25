import { sveltekit } from '@sveltejs/kit/vite';
import { createLogger, defineConfig } from 'vite';
import { resolve } from 'path';

const logger = createLogger();
const loggerWarn = logger.warn;
logger.warn = (msg, options) => {
    const text = String(msg);
    if (text.includes('Error when using sourcemap for reporting an error')) return;
    if (text.includes('contains an annotation that Rollup cannot interpret')) return;
    if (text.includes('Generated an empty chunk')) return;
    if (text.includes('Some chunks are larger than 500 kB')) return;
    loggerWarn(msg, options);
};

export default defineConfig({
    // Đọc .env từ monorepo root (chứa VITE_API_BASE, POSTGRES_*, JWT_*...)
    envDir: resolve(__dirname, '../..'),
    customLogger: logger,
    logLevel: 'error',
    plugins: [sveltekit()],
    server: {
        port: 5173,
        proxy: {
            '/api': {
                target: 'http://localhost:3000',
                changeOrigin: true
            }
        }
    },
    build: {
        sourcemap: false,
        chunkSizeWarningLimit: 2200,
        rollupOptions: {
            onwarn(warning, warn) {
                const message = String(warning.message ?? '');
                if (message.includes('Error when using sourcemap for reporting an error')) {
                    return;
                }
                if (message.includes('contains an annotation that Rollup cannot interpret')) {
                    return;
                }
                if (message.includes('Generated an empty chunk')) {
                    return;
                }
                warn(warning);
            },
            output: {
                manualChunks(id) {
                    if (id.includes('node_modules/echarts') || id.includes('node_modules/zrender')) {
                        return 'vendor-echarts';
                    }
                    if (id.includes('node_modules/cytoscape')) {
                        return 'vendor-cytoscape';
                    }
                    if (id.includes('node_modules/@xyflow')) {
                        return 'vendor-xyflow';
                    }
                    if (id.includes('node_modules/mermaid') || id.includes('node_modules/d3') || id.includes('node_modules/dagre')) {
                        return 'vendor-mermaid';
                    }
                    if (id.includes('node_modules/mammoth')) {
                        return 'vendor-mammoth';
                    }
                    if (id.includes('node_modules/html2pdf') || id.includes('node_modules/jspdf') || id.includes('node_modules/html2canvas')) {
                        return 'vendor-pdf';
                    }

                }
            }
        }
    }
});
