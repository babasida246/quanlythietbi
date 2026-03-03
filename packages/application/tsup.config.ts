import { defineConfig } from 'tsup'

export default defineConfig({
    entry: ['src/index.ts'],
    format: ['esm'],
    target: 'es2022',
    clean: true,
    dts: false,
    sourcemap: false,
    minify: false,
    splitting: false,
    noExternal: [
        '@qltb/domain',
        '@qltb/contracts',
    ],
    external: [
        'pg',
        'redis',
        'bull',
        'nodemailer',
    ],
})
