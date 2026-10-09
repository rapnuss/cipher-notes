import {bunPluginPino} from 'bun-plugin-pino'

const result = await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  target: 'bun',
  format: 'esm',
  minify: true,
  sourcemap: 'linked',
  plugins: [bunPluginPino({transports: ['pino-pretty']})],
})

if (!result.success) {
  for (const log of result.logs) console.error(log)
  process.exit(1)
}
