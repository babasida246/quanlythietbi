import nodeAdapter from '@sveltejs/adapter-node';
import staticAdapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const isMobileBuild = process.env.BUILD_TARGET === 'mobile';

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
        adapter: isMobileBuild
            ? staticAdapter({
                pages: 'build',
                assets: 'build',
                fallback: 'index.html',
                precompress: false
            })
            : nodeAdapter({
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
