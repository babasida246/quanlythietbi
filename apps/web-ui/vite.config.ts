import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
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
        rollupOptions: {
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
