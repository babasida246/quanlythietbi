import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const config = {
    preprocess: vitePreprocess(),
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
    },
    kit: {
        adapter: adapter({
            out: 'build',
            precompress: false,
            envPrefix: ''
        }),
        alias: {
            $lib: './src/lib'
        }
    }
};

export default config;
