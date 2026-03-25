import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const config = {
    preprocess: vitePreprocess(),
    kit: {
        adapter: adapter({
            pages: 'build',
            assets: 'build',
            fallback: 'index.html',  // SPA mode: unknown routes → index.html
            precompress: false
        }),
        alias: {
            $lib: './src/lib'
        }
    },
    vitePlugin: {
        onwarn(warning, handler) {
            // ToolsHub and MikroTikFullConfigPanel contain complex multi-control form
            // sections where adding for/id to every label is impractical.
            if (
                warning.code === 'a11y_label_has_associated_control' &&
                (warning.filename?.includes('ToolsHub') ||
                    warning.filename?.includes('MikroTikFullConfigPanel'))
            ) {
                return;
            }
            handler(warning);
        }
    }
};

export default config;
