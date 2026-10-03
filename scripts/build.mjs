import { build } from 'esbuild';
await build({entryPoints:['src/account.mjs'],outfile:'dist/account.js',bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true});
await build({entryPoints:['src/body3d.mjs'],outfile:'dist/body3d.js',bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true});
