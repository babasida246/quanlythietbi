import adapterStatic from '@sveltejs/adapter-static';
import adapterNode   from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// ADAPTER=node  → adapter-node  (Node.js server, dùng cho Docker / SSR)
// ADAPTER=static (default) → adapter-static (file tĩnh, nginx phục vụ trực tiếp)
const useNode = process.env.ADAPTER === 'node';

const adapter = useNode
    ? adapterNode({ out: 'build' })
    : adapterStatic({ pages: 'build', assets: 'build', fallback: 'index.html' });

const config = {
    preprocess: vitePreprocess(),
    kit: {
        adapter,
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
