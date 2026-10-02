import { build, context, type PluginBuild } from 'esbuild'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const require = createRequire(import.meta.url)
const [theme, preflight] = await Promise.all([
  readFile(require.resolve('tailwindcss/theme.css'), 'utf8'),
  readFile(require.resolve('tailwindcss/preflight.css'), 'utf8'),
])
await mkdir('dist', { recursive: true })
// Ship a fixed, trusted preset. Never load project configuration or CSS imports.
await writeFile(
  'dist/preview-base.css',
  `@layer theme, base, components, utilities;\n@layer theme {${theme}}\n@layer base {${preflight}}\n@layer utilities {@tailwind utilities;}`,
)
const options = {
  entryPoints: {
    extension: 'extension/extension.ts',
    'react-validation': 'extension/react-validation.ts',
  },
  bundle: true,
  platform: 'node' as const,
  format: 'cjs' as const,
  external: ['vscode'],
  target: 'node20',
  outdir: 'dist',
  outExtension: { '.js': '.cjs' },
  plugins: [
    {
      name: 'defer-react-validator',
      setup: (builder: PluginBuild) => {
        builder.onResolve({ filter: /^\.\/react-validation$/ }, (args) => {
          if (
            args.kind === 'dynamic-import' &&
            args.importer === resolve('extension/editor-replacement.ts')
          )
            return { path: './react-validation.cjs', external: true }
          return undefined
        })
      },
    },
  ],
  logLevel: 'info' as const,
}
if (process.argv.includes('--watch')) await (await context(options)).watch()
else await build(options)
