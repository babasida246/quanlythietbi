import { defineConfig } from 'tsup'
import fs from 'fs'
import path from 'path'

export default defineConfig({
    entry: ['src/main.ts'],
    format: ['esm'],
    target: 'es2022',
    clean: true,
    dts: false,
    sourcemap: false,
    minify: false,
    noExternal: [
        '@qltb/domain',
        '@qltb/contracts',
        '@qltb/application',
        '@qltb/infra-postgres',
    ],
    external: [
        'pg',
        'redis',
        'bull',
        'nodemailer',
    ],
    onSuccess: async () => {
        const srcLocales = 'src/locales'
        const distLocales = 'locales'

        if (!fs.existsSync(distLocales)) {
            fs.mkdirSync(distLocales, { recursive: true })
        }

        const copyRecursive = (src: string, dest: string) => {
            if (!fs.existsSync(src)) return
            const stat = fs.statSync(src)
            if (stat.isDirectory()) {
                if (!fs.existsSync(dest)) {
                    fs.mkdirSync(dest, { recursive: true })
                }
                const files = fs.readdirSync(src)
                files.forEach(file => {
                    copyRecursive(path.join(src, file), path.join(dest, file))
                })
            } else {
                fs.copyFileSync(src, dest)
            }
        }

        copyRecursive(srcLocales, distLocales)
        console.log('✓ Locale files copied to dist')

        // Copy built-in .docx templates: src/templates/docx/ → dist/templates/docx/
        copyRecursive('src/templates/docx', 'dist/templates/docx')
        console.log('✓ Docx template files copied to dist/templates/docx')
    }
})
