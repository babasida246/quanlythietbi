import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const webUiDir = resolve(__dirname, '..');

process.env.BUILD_TARGET = 'mobile';

console.log('[build-mobile] Building SvelteKit with adapter-static for Capacitor...');
execSync('pnpm svelte-kit sync && pnpm vite build', {
    cwd: webUiDir,
    stdio: 'inherit',
    env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=4096' }
});
console.log('[build-mobile] Done. Run "pnpm cap:sync" to sync with native platforms.');
