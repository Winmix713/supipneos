import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const output = resolve(process.argv[2] ?? '../outputs');
await mkdir(output, { recursive: true });
await import('./build-engine-core.mjs');
// The official Supabase client remains a remote Deno import. All WinMix code,
// including caller authorization, is bundled into a single deployable file.
const result = await build({
  entryPoints: ['supabase/functions/winmix-engine/index.ts'],
  bundle: true, format: 'esm', platform: 'neutral', target: 'es2022',
  external: ['https://*'], write: false, legalComments: 'none',
});
await writeFile(resolve(output, 'winmix-engine.ts'), result.outputFiles[0].contents);
console.log('Standalone WinMix Edge Function generated: winmix-engine.ts');
