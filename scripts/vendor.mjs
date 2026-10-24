import {build} from 'esbuild';
import {copyFile,mkdir} from 'node:fs/promises';
await mkdir('public/js/vendor',{recursive:true});
await build({entryPoints:['node_modules/qrcode/lib/browser.js'],outfile:'public/js/vendor/qrcode.js',bundle:true,format:'esm',platform:'browser',minify:true,legalComments:'eof'});
await copyFile('node_modules/qrcode/license','public/js/vendor/qrcode-LICENSE.txt');
await copyFile('node_modules/dijkstrajs/LICENSE.md','public/js/vendor/dijkstrajs-LICENSE.txt');

