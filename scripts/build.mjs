import { build } from 'esbuild';
await build({entryPoints:['src/account.mjs'],outfile:'dist/account.js',bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true});
