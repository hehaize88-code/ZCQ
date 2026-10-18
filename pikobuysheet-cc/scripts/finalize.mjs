import { build } from 'esbuild';
await build({ entryPoints: ['dist/server/entry.mjs'], outfile: 'dist/server/index.js', bundle: true, format: 'esm', platform: 'neutral', mainFields: ['module','main'], conditions: ['worker','browser'], target: 'es2022', external: ['node:*'], minify: true });
